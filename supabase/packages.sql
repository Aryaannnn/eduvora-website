-- =====================================================================
--  EDUVORA — COUNSELLING PACKAGES + SESSION CREDITS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Run it AFTER setup.sql, payments.sql, predictor-access.sql and
--  booking-payment-first.sql. Safe to run again.
--
--  How it works:
--   • A package is a product with category 'counselling_package'.
--     Bought with the normal Razorpay flow (price from the database),
--     with invoice + emails, shown in Admin → Payments.
--   • When a package purchase becomes PAID, its sessions are copied onto the
--     purchase (sessions_granted / sessions_unlimited) — later price or
--     session changes in the admin don't change what a student already bought.
--   • Credits = sessions from paid packages + admin adjustments
--               − active bookings made with a credit.
--     Cancelled bookings give the credit back. Refunded packages stop counting.
--   • Any paid package unlocks the full predictor (and the direct call
--     number — that rule already counts every paid purchase).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Packages are products of a new category
-- ---------------------------------------------------------------------
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('crash_course', 'study_material', 'previous_paper', 'mock_test', 'counselling_package'));

alter table public.products add column if not exists package_sessions  integer check (package_sessions is null or package_sessions between 1 and 100);
alter table public.products add column if not exists package_unlimited boolean not null default false;

-- Visitors may read the new columns (the price list is public)
grant select (package_sessions, package_unlimited) on public.products to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Purchases remember the sessions they gave
-- ---------------------------------------------------------------------
alter table public.purchases add column if not exists sessions_granted   integer check (sessions_granted is null or sessions_granted >= 0);
alter table public.purchases add column if not exists sessions_unlimited boolean not null default false;

create or replace function public.grant_package_sessions()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare p public.products;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select * into p from public.products where id = new.product_id;
    if found and p.category = 'counselling_package' then
      new.sessions_unlimited := p.package_unlimited;
      new.sessions_granted   := case when p.package_unlimited then null else coalesce(p.package_sessions, 1) end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_package_sessions on public.purchases;
create trigger grant_package_sessions
  before insert or update of status on public.purchases
  for each row execute function public.grant_package_sessions();

-- Packages already paid before this file was run
update public.purchases pu
   set sessions_unlimited = pr.package_unlimited,
       sessions_granted   = case when pr.package_unlimited then null else coalesce(pr.package_sessions, 1) end
  from public.products pr
 where pr.id = pu.product_id and pr.category = 'counselling_package'
   and pu.status = 'paid' and pu.sessions_granted is null and not pu.sessions_unlimited;


-- ---------------------------------------------------------------------
-- 3. Bookings know how they were paid
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists paid_with text check (paid_with is null or paid_with in ('razorpay', 'credit', 'free'));

-- Students can't change it (otherwise they could get a credit back)
create or replace function public.protect_booking_paid_with()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.paid_with is distinct from old.paid_with then
    raise exception 'You are not allowed to change these booking details.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_booking_paid_with on public.bookings;
create trigger protect_booking_paid_with
  before update on public.bookings
  for each row execute function public.protect_booking_paid_with();


-- ---------------------------------------------------------------------
-- 4. Admin adjustments (+2 / −1 …) with a note
-- ---------------------------------------------------------------------
create table if not exists public.session_credit_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  delta       integer not null check (delta between -100 and 100 and delta <> 0),
  note        text check (note is null or char_length(note) <= 300),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists credit_adj_user_idx on public.session_credit_adjustments (user_id);
alter table public.session_credit_adjustments enable row level security;

drop policy if exists "credit adj: read own or admin" on public.session_credit_adjustments;
drop policy if exists "credit adj: admin insert"      on public.session_credit_adjustments;
drop policy if exists "credit adj: admin delete"      on public.session_credit_adjustments;
create policy "credit adj: read own or admin" on public.session_credit_adjustments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "credit adj: admin insert" on public.session_credit_adjustments
  for insert to authenticated with check (public.is_admin());
create policy "credit adj: admin delete" on public.session_credit_adjustments
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. Credits balance — one rule used everywhere
-- ---------------------------------------------------------------------
create or replace function public.session_credits(p_user uuid default auth.uid())
returns table (total integer, used integer, remaining integer, unlimited boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_granted integer; v_adj integer; v_used integer; v_unl boolean;
begin
  if p_user is null or (auth.uid() is not null and p_user <> auth.uid() and not public.is_admin()) then
    return query select 0, 0, 0, false;
    return;
  end if;

  select coalesce(sum(sessions_granted), 0), coalesce(bool_or(sessions_unlimited), false)
    into v_granted, v_unl
    from public.purchases where user_id = p_user and status = 'paid';
  select coalesce(sum(delta), 0) into v_adj from public.session_credit_adjustments where user_id = p_user;
  select count(*) into v_used from public.bookings
   where user_id = p_user and paid_with = 'credit' and status in ('pending', 'confirmed', 'completed');

  return query select (v_granted + v_adj)::integer, v_used::integer, greatest(v_granted + v_adj - v_used, 0)::integer, v_unl;
end;
$$;
revoke all on function public.session_credits(uuid) from public, anon;
grant execute on function public.session_credits(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 6. Book a slot with one credit (server only). Confirmed at once.
-- ---------------------------------------------------------------------
create or replace function public.book_with_credit(
  p_user uuid, p_slot uuid, p_name text, p_phone text, p_email text,
  p_class_year text, p_expected_marks numeric, p_message text
)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare c record; b public.bookings;
begin
  -- one booking at a time per student, so two clicks can't spend the same credit
  perform pg_advisory_xact_lock(hashtext('credit:' || p_user::text));
  perform public.release_expired_holds();

  select * into c from public.session_credits(p_user);
  if not c.unlimited and c.remaining < 1 then
    raise exception 'No session credits left. Please buy a package or pay for this slot.';
  end if;

  -- drop this student's own unpaid holds first (frees those slots)
  update public.bookings
     set status = 'expired', payment_status = case when payment_status = 'pending' then 'unpaid' else payment_status end, hold_expires_at = null
   where user_id = p_user and status = 'awaiting_payment';

  insert into public.bookings (user_id, slot_id, name, phone, email, class_year, expected_marks, message,
                               status, payment_status, amount, paid_with, paid_at)
  values (p_user, p_slot, p_name, p_phone, nullif(p_email, ''), nullif(p_class_year, ''), p_expected_marks, nullif(p_message, ''),
          'confirmed', 'paid', 0, 'credit', now())
  returning * into b;   -- the insert trigger takes the slot (or says "no longer available")
  return b;
end;
$$;
revoke all on function public.book_with_credit(uuid, uuid, text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.book_with_credit(uuid, uuid, text, text, text, text, numeric, text) to service_role;


-- ---------------------------------------------------------------------
-- 7. Predictor: any PAID package also unlocks it (same rule as before + this)
-- ---------------------------------------------------------------------
create or replace function public.has_predictor_access(p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare o boolean;
begin
  if p_user is null then return false; end if;
  if auth.uid() is not null and p_user <> auth.uid() and not public.is_admin() then return false; end if;

  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then return true; end if;

  select has_access into o from public.predictor_access_overrides where user_id = p_user;
  if o is not null then return o; end if;

  return exists (
    select 1 from public.bookings
     where user_id = p_user
       and payment_status = 'paid'
       and status in ('confirmed', 'completed')
  ) or exists (
    select 1 from public.purchases pu join public.products pr on pr.id = pu.product_id
     where pu.user_id = p_user and pu.status = 'paid' and pr.category = 'counselling_package'
  );
end;
$$;
revoke all on function public.has_predictor_access(uuid) from public, anon;
grant execute on function public.has_predictor_access(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 8. The three starting packages (edit them later in Admin → Packages)
-- ---------------------------------------------------------------------
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, package_sessions, package_unlimited, details)
values
  ('Basic', 'package-basic', 'One focused counselling session for your rank, campus and branch plan.', 'counselling_package', 499, null, false, true, 1, 1, false,
   '{"tagline": "Quick expert guidance", "features": ["1 one-to-one counselling session", "Campus & branch plan for your rank", "Fee category guidance"]}'::jsonb),
  ('Complete', 'package-complete', 'Three sessions, the full predictor and WhatsApp support through counselling.', 'counselling_package', 1499, null, false, true, 2, 3, false,
   '{"tagline": "Best for most students", "popular": true, "features": ["3 one-to-one counselling sessions", "Full Rank & College Predictor", "WhatsApp support until counselling ends", "Choice list review"]}'::jsonb),
  ('Premium', 'package-premium', 'Unlimited sessions until admission, with choice filling help and priority support.', 'counselling_package', 2999, null, false, true, 3, null, true,
   '{"tagline": "Till you get admission", "features": ["Unlimited sessions until admission", "Full Rank & College Predictor", "Choice filling help", "Priority WhatsApp support"]}'::jsonb)
on conflict (slug) do nothing;
