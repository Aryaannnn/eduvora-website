-- =====================================================================
--  EDUVORA — PRIVACY: CONSENT DATE + ACCOUNT DELETION
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Run it after all other files. Safe to run again.
--
--  • profiles.consent_at: when the student agreed to the Privacy Policy and
--    Terms (saved at sign-up, or when they accept the one-time prompt).
--  • Payment records (purchases, paid bookings) are KEPT when an account is
--    deleted (needed for tax), but the person is removed from them:
--    the link to the account becomes empty and name / phone / email on
--    bookings are replaced by "Deleted user".
--  • account_deletions: a log WITHOUT personal data (when, by whom).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Consent
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists consent_at      timestamptz;
alter table public.profiles add column if not exists consent_version text;

-- New accounts: save the consent from the sign-up form (same as setup.sql + consent)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
  v_consent boolean := coalesce(new.raw_user_meta_data ->> 'privacy_consent', '') = 'true';
begin
  -- Never trust the sign-up form for 'admin'
  if v_role not in ('student', 'parent') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, phone, role, consent_at, consent_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.phone,
    v_role,
    case when v_consent then now() end,
    case when v_consent then left(new.raw_user_meta_data ->> 'consent_version', 40) end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Keep payment records when an account is deleted
-- ---------------------------------------------------------------------
alter table public.purchases add column if not exists anonymised_at timestamptz;
alter table public.bookings  add column if not exists anonymised_at timestamptz;

alter table public.purchases alter column user_id drop not null;
alter table public.bookings  alter column user_id drop not null;

-- user_id → "set null" instead of "delete the payment"
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl
      from pg_constraint c
     where c.contype = 'f'
       and c.conrelid in ('public.purchases'::regclass, 'public.bookings'::regclass)
       and c.confrelid = 'auth.users'::regclass
       and c.confdeltype = 'c'                                  -- currently "on delete cascade"
       and (select attname from pg_attribute where attrelid = c.conrelid and attnum = c.conkey[1]) = 'user_id'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (user_id) references auth.users (id) on delete set null', r.tbl, r.conname);
  end loop;
end;
$$;

-- A refund of a deleted user's old payment must not try to give credit back to nobody
do $$
begin
  if to_regprocedure('public.on_payment_refunded(uuid, uuid, uuid, integer)') is not null then
    execute $f$
    create or replace function public.on_payment_refunded(p_user uuid, p_purchase uuid, p_booking uuid, p_reward_used integer)
    returns void
    language plpgsql security definer set search_path = public
    as $body$
    declare r public.referrals;
    begin
      update public.coupon_redemptions set status = 'cancelled'
       where (p_purchase is not null and purchase_id = p_purchase) or (p_booking is not null and booking_id = p_booking);

      if coalesce(p_reward_used, 0) > 0 and p_user is not null then
        insert into public.reward_ledger (user_id, amount, kind, purchase_id, booking_id, note)
        values (p_user, p_reward_used, 'restored', p_purchase, p_booking, 'Payment refunded');
      end if;

      select * into r from public.referrals
       where status = 'rewarded' and ((p_purchase is not null and purchase_id = p_purchase) or (p_booking is not null and booking_id = p_booking))
       for update;
      if found then
        update public.referrals set status = 'cancelled', cancelled_at = now(), cancel_reason = 'First payment refunded' where id = r.id;
        if r.referrer_reward > 0 then
          insert into public.reward_ledger (user_id, amount, kind, referral_id, purchase_id, booking_id, note)
          values (r.referrer_id, -r.referrer_reward, 'reversed', r.id, p_purchase, p_booking, 'Friend''s payment was refunded');
        end if;
      end if;
    end;
    $body$;
    $f$;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Deletion log (no personal data)
-- ---------------------------------------------------------------------
create table if not exists public.account_deletions (
  id               bigint generated always as identity primary key,
  account_ref      text not null,            -- one-way code of the old account id (not reversible)
  requested_by     text not null check (requested_by in ('student', 'admin')),
  admin_id         uuid references auth.users (id) on delete set null,
  purchases_kept   integer not null default 0,
  bookings_kept    integer not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.account_deletions enable row level security;
drop policy if exists "deletions: admins read" on public.account_deletions;
create policy "deletions: admins read" on public.account_deletions for select to authenticated using (public.is_admin());
-- (Only the website's server writes this log.)


-- ---------------------------------------------------------------------
-- 4. Remove a person's data (server only). Runs all steps together.
--    The website then deletes the login itself (auth user), which also
--    removes the profile, credits, referrals and coupon uses.
--    Returns how many payment records were kept (anonymised).
-- ---------------------------------------------------------------------
create or replace function public.delete_account_data(p_user uuid, p_requested_by text, p_admin uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  v_email text;
  v_phone text;
  v_purchases integer := 0;
  v_bookings integer := 0;
begin
  select * into me from public.profiles where id = p_user;
  v_email := lower(nullif(trim(coalesce(me.email, (select email from auth.users where id = p_user))), ''));
  v_phone := right(regexp_replace(coalesce(me.phone, ''), '\D', '', 'g'), 10);

  delete from public.predictions   where user_id = p_user;
  delete from public.test_attempts where user_id = p_user;

  if to_regclass('public.enquiries') is not null then
    delete from public.enquiries
     where user_id = p_user
        or (v_email is not null and lower(email) = v_email)
        or (length(v_phone) = 10 and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_phone);
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'user_id') then
    execute 'delete from public.reviews where user_id = $1' using p_user;
  end if;

  update public.bookings
     set name = 'Deleted user', phone = 'deleted', email = null, message = null, class_year = null, expected_marks = null, anonymised_at = now()
   where user_id = p_user;
  get diagnostics v_bookings = row_count;

  update public.purchases set anonymised_at = now() where user_id = p_user;
  get diagnostics v_purchases = row_count;

  if to_regclass('public.email_logs') is not null and v_email is not null then
    update public.email_logs set to_email = 'deleted-account' where lower(to_email) = v_email;
  end if;
  if to_regclass('public.file_downloads') is not null then
    execute 'update public.file_downloads set device = null, user_agent = null where user_id = $1' using p_user;
  end if;

  insert into public.account_deletions (account_ref, requested_by, admin_id, purchases_kept, bookings_kept)
  values (md5(p_user::text || 'eduvora'), p_requested_by, p_admin, v_purchases, v_bookings);

  return jsonb_build_object('purchases_kept', v_purchases, 'bookings_kept', v_bookings);
end;
$$;
revoke all on function public.delete_account_data(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid, text, uuid) to service_role;
