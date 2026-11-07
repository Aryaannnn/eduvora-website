-- =====================================================================
--  EDUVORA — ADMIN SECURITY: 2-FACTOR LOGIN + ACTIVITY LOG
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Run it LAST (after all other files). Safe to run again.
--
--  ⚠️ After this, an admin account has admin powers ONLY when it signed in
--     with the authenticator-app code (2FA). The website guides every admin
--     through a one-time setup (QR code) at /admin. The Supabase dashboard
--     itself is not affected.
--
--  1. is_admin() now also requires a 2FA login (aal2) — so even with a
--     stolen password nobody can change prices, payments or users.
--  2. admin_activity: every change an admin makes is recorded automatically
--     by triggers (prices old → new, products, slots, bookings, reviews,
--     roles, refunds, coupons, credits, predictor access) + data exports
--     and 2FA sign-ins. Nobody can edit or delete the log.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Admin = role 'admin' AND signed in with 2FA in this session
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;


-- ---------------------------------------------------------------------
-- 2. The activity log (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.admin_activity (
  id           bigint generated always as identity primary key,
  admin_id     uuid references auth.users (id) on delete set null,
  admin_name   text not null,
  action       text not null,            -- e.g. product.price, booking.status, data.export
  entity       text,                     -- table name
  entity_id    text,
  summary      text not null,            -- "Price of “45-Day Crash Course”: ₹4,999 → ₹3,999"
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_activity_time_idx on public.admin_activity (created_at desc);

alter table public.admin_activity enable row level security;
drop policy if exists "activity: admins read" on public.admin_activity;
create policy "activity: admins read" on public.admin_activity for select to authenticated using (public.is_admin());
-- No insert / update / delete policies: rows are added only by the functions below.

create or replace function public.admin_activity_is_read_only()
returns trigger language plpgsql as $$
begin
  raise exception 'The activity log cannot be changed or deleted.';
end;
$$;
drop trigger if exists admin_activity_read_only on public.admin_activity;
create trigger admin_activity_read_only before update or delete on public.admin_activity
  for each row execute function public.admin_activity_is_read_only();
revoke truncate on public.admin_activity from anon, authenticated, service_role;


-- Who is doing this? (null = not an admin action → not logged)
create or replace function public.activity_actor(out actor_id uuid, out actor_name text)
language plpgsql stable security definer set search_path = public
as $$
declare p public.profiles;
begin
  actor_id := auth.uid();
  if actor_id is null then
    -- Every request from the website (visitors, students, the website's own server
    -- for payments/emails) carries a token with a role. No token at all = someone
    -- changing data directly in the Supabase dashboard / SQL editor → log it.
    if coalesce(auth.jwt() ->> 'role', '') = '' then
      actor_name := 'Supabase dashboard';
    end if;
    return;                      -- website server / visitors: not an admin action
  end if;
  select * into p from public.profiles where id = actor_id;
  if p.role is distinct from 'admin' then actor_id := null; return; end if;
  actor_name := coalesce(nullif(p.full_name, ''), p.email, 'Admin');
end;
$$;

-- Columns that changed: { column: [old, new] } (ignores noisy columns)
create or replace function public.activity_changes(o jsonb, n jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k.key, jsonb_build_array(o -> k.key, k.value)), '{}'::jsonb)
    from jsonb_each(n) k
   where (o -> k.key) is distinct from k.value
     and k.key not in ('updated_at', 'content_html', 'hold_expires_at', 'download_count');
$$;

create or replace function public.rupees(v numeric)
returns text language sql immutable as $$
  select '₹' || to_char(coalesce(v, 0), 'FM99,99,99,990');
$$;

-- Log something that isn't a table change (data export, 2FA sign-in). Admins only.
create or replace function public.log_admin_event(p_action text, p_summary text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  if not public.is_admin() then raise exception 'Only admins can do this.'; end if;
  select * into a from public.activity_actor();
  insert into public.admin_activity (admin_id, admin_name, action, summary, details)
  values (a.actor_id, coalesce(a.actor_name, 'Admin'), left(p_action, 60), left(p_summary, 500), coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function public.log_admin_event(text, text, jsonb) from public, anon;
grant execute on function public.log_admin_event(text, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 3. One trigger for every watched table
-- ---------------------------------------------------------------------
create or replace function public.log_admin_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  r jsonb := case when tg_op = 'DELETE' then o else n end;   -- the row we talk about
  ch jsonb := public.activity_changes(o, n);
  act text; msg text; nm text; label text;
begin
  select * into a from public.activity_actor();
  if a.actor_name is null then return null; end if;          -- not an admin action
  if tg_op = 'UPDATE' and ch = '{}'::jsonb then return null; end if;

  case tg_table_name
  when 'products' then
    label := case when r ->> 'category' = 'counselling_package' then 'package' else 'product' end;
    nm := '“' || (r ->> 'title') || '”';
    if tg_op = 'INSERT' then act := label || '.add'; msg := 'Added ' || label || ' ' || nm || ' (' || public.rupees((r ->> 'price')::numeric) || ')';
    elsif tg_op = 'DELETE' then act := label || '.delete'; msg := 'Deleted ' || label || ' ' || nm;
    elsif ch ? 'price' then act := label || '.price'; msg := 'Price of ' || nm || ': ' || public.rupees((o ->> 'price')::numeric) || ' → ' || public.rupees((n ->> 'price')::numeric);
    elsif ch ? 'is_active' then act := label || '.visibility'; msg := (case when (n ->> 'is_active')::boolean then 'Showed ' else 'Hid ' end) || label || ' ' || nm;
    else act := label || '.edit'; msg := 'Edited ' || label || ' ' || nm || ' (' || (select string_agg(k, ', ') from jsonb_object_keys(ch) k) || ')';
    end if;

  when 'slots' then
    nm := to_char((r ->> 'date')::date, 'DD Mon YYYY') || ', ' || left(r ->> 'start_time', 5);
    if tg_op = 'INSERT' then act := 'slot.add'; msg := 'Added slot ' || nm || ' (' || public.rupees((r ->> 'price')::numeric) || ')';
    elsif tg_op = 'DELETE' then act := 'slot.delete'; msg := 'Deleted slot ' || nm;
    elsif ch ? 'price' then act := 'slot.price'; msg := 'Slot ' || nm || ' price: ' || public.rupees((o ->> 'price')::numeric) || ' → ' || public.rupees((n ->> 'price')::numeric);
    elsif ch ? 'is_available' and (select count(*) from jsonb_object_keys(ch)) = 1 then return null; -- booked / freed by a booking change (logged there)
    else act := 'slot.edit'; msg := 'Changed slot ' || nm || ' (' || (select string_agg(k, ', ') from jsonb_object_keys(ch) k) || ')';
    end if;

  when 'bookings' then
    nm := coalesce(r ->> 'name', 'student');
    if tg_op = 'DELETE' then act := 'booking.delete'; msg := 'Deleted booking of ' || nm;
    elsif tg_op = 'INSERT' then act := 'booking.add'; msg := 'Added booking for ' || nm;
    elsif ch ? 'status' or ch ? 'payment_status' then
      act := 'booking.status';
      msg := 'Booking of ' || nm || ': '
        || concat_ws(', ',
             case when ch ? 'status' then (o ->> 'status') || ' → ' || (n ->> 'status') end,
             case when ch ? 'payment_status' then 'payment ' || (o ->> 'payment_status') || ' → ' || (n ->> 'payment_status') end);
    elsif ch ? 'slot_id' then act := 'booking.reschedule'; msg := 'Rescheduled booking of ' || nm;
    else act := 'booking.edit'; msg := 'Edited booking of ' || nm;
    end if;

  when 'reviews' then
    nm := coalesce(r ->> 'name', 'someone');
    if tg_op = 'INSERT' then act := 'review.add'; msg := 'Added review by ' || nm;
    elsif tg_op = 'DELETE' then act := 'review.delete'; msg := 'Deleted review by ' || nm;
    elsif ch ? 'is_approved' then act := case when (n ->> 'is_approved')::boolean then 'review.approve' else 'review.hide' end;
      msg := (case when (n ->> 'is_approved')::boolean then 'Approved review by ' else 'Hid review by ' end) || nm;
    else act := 'review.edit'; msg := 'Edited review by ' || nm;
    end if;

  when 'profiles' then
    if tg_op <> 'UPDATE' or not ch ? 'role' then return null; end if;
    act := 'user.role';
    msg := 'Changed role of ' || coalesce(nullif(r ->> 'full_name', ''), r ->> 'email', 'a user') || ': ' || (o ->> 'role') || ' → ' || (n ->> 'role');

  when 'purchases' then
    nm := coalesce((select '“' || title || '”' from public.products where id = (r ->> 'product_id')::uuid), 'an item');
    if tg_op = 'INSERT' then act := 'payment.record'; msg := 'Recorded payment ' || public.rupees((r ->> 'amount')::numeric) || ' for ' || nm || ' (' || (r ->> 'status') || ')';
    elsif tg_op = 'DELETE' then act := 'payment.delete'; msg := 'Deleted payment ' || public.rupees((r ->> 'amount')::numeric) || ' for ' || nm;
    elsif ch ? 'status' and n ->> 'status' = 'refunded' then act := 'payment.refund'; msg := 'Refunded ' || public.rupees((r ->> 'amount')::numeric) || ' for ' || nm || coalesce(' — ' || (n ->> 'refund_note'), '');
    elsif ch ? 'status' then act := 'payment.status'; msg := 'Payment ' || public.rupees((r ->> 'amount')::numeric) || ' for ' || nm || ': ' || (o ->> 'status') || ' → ' || (n ->> 'status');
    else return null;
    end if;

  when 'coupons' then
    nm := r ->> 'code';
    if tg_op = 'INSERT' then act := 'coupon.add'; msg := 'Created coupon ' || nm;
    elsif tg_op = 'DELETE' then act := 'coupon.delete'; msg := 'Deleted coupon ' || nm;
    elsif ch ? 'is_active' and (select count(*) from jsonb_object_keys(ch)) = 1 then act := 'coupon.visibility'; msg := (case when (n ->> 'is_active')::boolean then 'Activated' else 'Deactivated' end) || ' coupon ' || nm;
    else act := 'coupon.edit'; msg := 'Edited coupon ' || nm || ' (' || (select string_agg(k, ', ') from jsonb_object_keys(ch) k) || ')';
    end if;

  when 'session_credit_adjustments' then
    if tg_op <> 'INSERT' then return null; end if;
    act := 'credits.adjust';
    msg := 'Session credits ' || (case when (r ->> 'delta')::int > 0 then '+' else '' end) || (r ->> 'delta') || ' for '
      || coalesce((select coalesce(nullif(full_name, ''), email) from public.profiles where id = (r ->> 'user_id')::uuid), 'a student')
      || coalesce(' — ' || (r ->> 'note'), '');

  when 'predictor_access_overrides' then
    act := 'predictor.access';
    msg := 'Predictor access for ' || coalesce((select coalesce(nullif(full_name, ''), email) from public.profiles where id = (r ->> 'user_id')::uuid), 'a student') || ': '
      || case when tg_op = 'DELETE' then 'back to automatic' when (r ->> 'has_access')::boolean then 'given' else 'removed' end;

  else
    act := tg_table_name || '.' || lower(tg_op); msg := initcap(lower(tg_op)) || ' in ' || tg_table_name;
  end case;

  insert into public.admin_activity (admin_id, admin_name, action, entity, entity_id, summary, details)
  values (a.actor_id, a.actor_name, act, tg_table_name, r ->> 'id', left(msg, 500),
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', ch) else jsonb_build_object('row', r - 'content_html') end);
  return null;
end;
$$;

-- Attach it to every watched table that exists
do $$
declare t text;
begin
  foreach t in array array['products', 'slots', 'bookings', 'reviews', 'profiles', 'purchases', 'coupons', 'session_credit_adjustments', 'predictor_access_overrides'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_admin_change on public.%I', t);
      execute format('create trigger log_admin_change after insert or update or delete on public.%I for each row execute function public.log_admin_change()', t);
    end if;
  end loop;
end;
$$;
