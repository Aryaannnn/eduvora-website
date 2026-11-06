-- =====================================================================
--  EDUVORA — COUPON CODES + REFERRALS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Run it AFTER setup.sql, payments.sql, refunds.sql,
--  booking-payment-first.sql and packages.sql. Safe to run again.
--
--  • Coupons: % or flat discount, minimum amount, chosen products /
--    packages / slots, dates, max total uses, once per student.
--  • Referrals: every student gets a code. A NEW student who signs up with
--    it gets ₹100 off their first payment; the referrer gets a ₹100 reward
--    credit — only after that payment is PAID, and taken back if refunded.
--  • All prices are worked out on the server; these triggers record what
--    happened when a payment becomes paid / failed / refunded.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Settings (Admin → Settings → Referrals)
-- ---------------------------------------------------------------------
create table if not exists public.referral_settings (
  id                 integer primary key default 1 check (id = 1),
  enabled            boolean not null default true,
  referred_discount  integer not null default 100 check (referred_discount between 0 and 10000),
  referrer_reward    integer not null default 100 check (referrer_reward between 0 and 10000),
  updated_at         timestamptz not null default now()
);
insert into public.referral_settings (id) values (1) on conflict (id) do nothing;
alter table public.referral_settings enable row level security;
drop policy if exists "referral settings: anyone reads" on public.referral_settings;
drop policy if exists "referral settings: admin updates" on public.referral_settings;
create policy "referral settings: anyone reads" on public.referral_settings for select to anon, authenticated using (true);
create policy "referral settings: admin updates" on public.referral_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2. Coupons (Admin → Coupons)
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description       text check (description is null or char_length(description) <= 200),
  discount_type     text not null check (discount_type in ('percent', 'flat')),
  discount_value    integer not null check (discount_value > 0),
  max_discount      integer check (max_discount is null or max_discount > 0),  -- cap for % coupons
  min_amount        integer not null default 0 check (min_amount >= 0),
  applies_to        text not null default 'all' check (applies_to in ('all', 'selected')),
  product_ids       uuid[] not null default '{}',     -- when 'selected': these products / packages
  include_slots     boolean not null default true,    -- single counselling slots
  starts_at         timestamptz,
  ends_at           timestamptz,
  max_uses          integer check (max_uses is null or max_uses > 0),
  once_per_student  boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);
alter table public.coupons enable row level security;
drop policy if exists "coupons: admin all" on public.coupons;
create policy "coupons: admin all" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- (Students never read this table — the server checks codes.)

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete cascade,
  discount    integer not null check (discount >= 0),
  status      text not null default 'pending' check (status in ('pending', 'used', 'cancelled')),
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index if not exists coupon_red_coupon_idx on public.coupon_redemptions (coupon_id, status);
create index if not exists coupon_red_user_idx on public.coupon_redemptions (user_id);
alter table public.coupon_redemptions enable row level security;
drop policy if exists "coupon uses: admin reads" on public.coupon_redemptions;
create policy "coupon uses: admin reads" on public.coupon_redemptions for select to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------
-- 3. What each payment was charged (filled only by the server)
-- ---------------------------------------------------------------------
alter table public.purchases add column if not exists original_amount   integer check (original_amount is null or original_amount >= 0);
alter table public.purchases add column if not exists coupon_id         uuid references public.coupons (id) on delete set null;
alter table public.purchases add column if not exists coupon_code       text;
alter table public.purchases add column if not exists coupon_discount   integer not null default 0 check (coupon_discount >= 0);
alter table public.purchases add column if not exists referral_discount integer not null default 0 check (referral_discount >= 0);
alter table public.purchases add column if not exists reward_used       integer not null default 0 check (reward_used >= 0);

alter table public.bookings add column if not exists original_amount   integer check (original_amount is null or original_amount >= 0);
alter table public.bookings add column if not exists coupon_id         uuid references public.coupons (id) on delete set null;
alter table public.bookings add column if not exists coupon_code       text;
alter table public.bookings add column if not exists coupon_discount   integer not null default 0 check (coupon_discount >= 0);
alter table public.bookings add column if not exists referral_discount integer not null default 0 check (referral_discount >= 0);
alter table public.bookings add column if not exists reward_used       integer not null default 0 check (reward_used >= 0);


-- ---------------------------------------------------------------------
-- 4. Referral codes + who referred whom
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by   uuid references auth.users (id) on delete set null;

-- Students can't set these themselves (only the server can)
create or replace function public.protect_profile_referral()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.referral_code is distinct from old.referral_code or new.referred_by is distinct from old.referred_by) then
    raise exception 'You are not allowed to change your referral details.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_referral on public.profiles;
create trigger protect_profile_referral before update on public.profiles
  for each row execute function public.protect_profile_referral();

create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references auth.users (id) on delete cascade,
  referred_id        uuid not null unique references auth.users (id) on delete cascade,
  code               text not null,
  status             text not null default 'joined' check (status in ('joined', 'rewarded', 'cancelled')),
  referred_discount  integer not null default 0,
  referrer_reward    integer not null default 0,
  purchase_id        uuid references public.purchases (id) on delete set null,
  booking_id         uuid references public.bookings (id) on delete set null,
  created_at         timestamptz not null default now(),
  rewarded_at        timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
drop policy if exists "referrals: referrer or admin reads" on public.referrals;
create policy "referrals: referrer or admin reads" on public.referrals
  for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

-- Reward credit ledger (+ earned / − spent / − taken back / + given back)
create table if not exists public.reward_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  amount       integer not null check (amount <> 0),
  kind         text not null check (kind in ('referral', 'spent', 'reversed', 'restored', 'adjustment')),
  referral_id  uuid references public.referrals (id) on delete set null,
  purchase_id  uuid references public.purchases (id) on delete set null,
  booking_id   uuid references public.bookings (id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists reward_ledger_user_idx on public.reward_ledger (user_id);
alter table public.reward_ledger enable row level security;
drop policy if exists "rewards: own or admin reads" on public.reward_ledger;
create policy "rewards: own or admin reads" on public.reward_ledger
  for select to authenticated using (user_id = auth.uid() or public.is_admin());


-- ---------------------------------------------------------------------
-- 5. Functions (server only)
-- ---------------------------------------------------------------------
-- Give a student their personal code (made once, e.g. EDU7K2QX)
create or replace function public.ensure_referral_code(p_user uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare c text;
begin
  select referral_code into c from public.profiles where id = p_user;
  if c is not null then return c; end if;
  loop
    c := 'EDU' || upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 5));
    exit when length(c) = 8 and not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  update public.profiles set referral_code = c where id = p_user and referral_code is null;
  select referral_code into c from public.profiles where id = p_user;
  return c;
end;
$$;

-- A NEW student opened someone's link → remember who referred them.
-- Returns: ok | disabled | invalid | self | already | not_new
create or replace function public.claim_referral(p_user uuid, p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare s public.referral_settings; ref public.profiles; me public.profiles;
begin
  select * into s from public.referral_settings where id = 1;
  if not coalesce(s.enabled, false) then return 'disabled'; end if;

  select * into ref from public.profiles where referral_code = upper(trim(p_code));
  if not found then return 'invalid'; end if;
  select * into me from public.profiles where id = p_user for update;
  if not found then return 'invalid'; end if;

  -- no self-referrals (same account, or the same phone number on two accounts)
  if ref.id = me.id or (ref.phone is not null and me.phone is not null and right(ref.phone, 10) = right(me.phone, 10)) then
    return 'self';
  end if;
  if me.referred_by is not null or exists (select 1 from public.referrals where referred_id = p_user) then return 'already'; end if;

  -- only NEW students: account made in the last 7 days and nothing paid yet
  if me.created_at < now() - interval '7 days'
     or exists (select 1 from public.purchases where user_id = p_user and status in ('paid', 'refunded') and amount > 0)
     or exists (select 1 from public.bookings where user_id = p_user and payment_status in ('paid', 'refunded') and coalesce(amount, 0) > 0) then
    return 'not_new';
  end if;

  insert into public.referrals (referrer_id, referred_id, code, referred_discount, referrer_reward)
  values (ref.id, p_user, ref.referral_code, s.referred_discount, s.referrer_reward);
  update public.profiles set referred_by = ref.id where id = p_user;
  return 'ok';
end;
$$;

-- Reward credit a student can spend now (balance minus amounts held by
-- checkouts started in the last 30 minutes)
create or replace function public.reward_available(p_user uuid)
returns integer
language plpgsql stable security definer set search_path = public
as $$
declare bal integer; held integer;
begin
  select coalesce(sum(amount), 0) into bal from public.reward_ledger where user_id = p_user;
  select coalesce(sum(reward_used), 0) into held from (
    select reward_used from public.purchases where user_id = p_user and status in ('created', 'pending') and created_at > now() - interval '30 minutes'
    union all
    select reward_used from public.bookings where user_id = p_user and status = 'awaiting_payment'
  ) x;
  return greatest(bal - held, 0);
end;
$$;

revoke all on function public.ensure_referral_code(uuid) from public, anon, authenticated;
revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;
revoke all on function public.reward_available(uuid) from public, anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to service_role;
grant execute on function public.claim_referral(uuid, text) to service_role;
grant execute on function public.reward_available(uuid) to service_role;


-- ---------------------------------------------------------------------
-- 6. When a payment changes: coupons, rewards, referrals
-- ---------------------------------------------------------------------
create or replace function public.on_payment_paid(p_user uuid, p_purchase uuid, p_booking uuid, p_amount integer, p_reward_used integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.referrals;
begin
  update public.coupon_redemptions set status = 'used', used_at = now()
   where status <> 'used' and ((p_purchase is not null and purchase_id = p_purchase) or (p_booking is not null and booking_id = p_booking));

  if coalesce(p_reward_used, 0) > 0 then
    insert into public.reward_ledger (user_id, amount, kind, purchase_id, booking_id, note)
    values (p_user, -p_reward_used, 'spent', p_purchase, p_booking, 'Used at checkout');
  end if;

  -- First real (paid) payment of a referred student → reward the referrer
  if coalesce(p_amount, 0) > 0 then
    select * into r from public.referrals where referred_id = p_user and status = 'joined' for update;
    if found then
      update public.referrals set status = 'rewarded', rewarded_at = now(), purchase_id = p_purchase, booking_id = p_booking where id = r.id;
      if r.referrer_reward > 0 then
        insert into public.reward_ledger (user_id, amount, kind, referral_id, purchase_id, booking_id, note)
        values (r.referrer_id, r.referrer_reward, 'referral', r.id, p_purchase, p_booking, 'Friend''s first payment');
      end if;
    end if;
  end if;
end;
$$;

create or replace function public.on_payment_refunded(p_user uuid, p_purchase uuid, p_booking uuid, p_reward_used integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.referrals;
begin
  update public.coupon_redemptions set status = 'cancelled'
   where (p_purchase is not null and purchase_id = p_purchase) or (p_booking is not null and booking_id = p_booking);

  if coalesce(p_reward_used, 0) > 0 then
    insert into public.reward_ledger (user_id, amount, kind, purchase_id, booking_id, note)
    values (p_user, p_reward_used, 'restored', p_purchase, p_booking, 'Payment refunded');
  end if;

  -- The referral reward came from this payment → take it back
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
$$;

revoke all on function public.on_payment_paid(uuid, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.on_payment_refunded(uuid, uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.purchases_after_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.on_payment_paid(new.user_id, new.id, null, new.amount, new.reward_used);
  elsif tg_op = 'UPDATE' and new.status = 'refunded' and old.status = 'paid' then
    perform public.on_payment_refunded(new.user_id, new.id, null, new.reward_used);
  elsif tg_op = 'UPDATE' and new.status in ('failed', 'abandoned') and old.status is distinct from new.status then
    update public.coupon_redemptions set status = 'cancelled' where purchase_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
drop trigger if exists purchases_after_change on public.purchases;
create trigger purchases_after_change after insert or update of status on public.purchases
  for each row execute function public.purchases_after_change();

create or replace function public.bookings_after_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.payment_status = 'paid' and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
    perform public.on_payment_paid(new.user_id, null, new.id, coalesce(new.amount, 0), new.reward_used);
  elsif tg_op = 'UPDATE' and new.payment_status = 'refunded' and old.payment_status = 'paid' then
    perform public.on_payment_refunded(new.user_id, null, new.id, new.reward_used);
  elsif tg_op = 'UPDATE' and new.payment_status <> 'paid' and (new.status = 'expired' or new.payment_status = 'failed')
        and (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status) then
    update public.coupon_redemptions set status = 'cancelled' where booking_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
drop trigger if exists bookings_after_change on public.bookings;
create trigger bookings_after_change after insert or update of status, payment_status on public.bookings
  for each row execute function public.bookings_after_change();


-- ---------------------------------------------------------------------
-- 7. A sample coupon (inactive) — edit or delete it in Admin → Coupons
-- ---------------------------------------------------------------------
insert into public.coupons (code, description, discount_type, discount_value, max_discount, min_amount, is_active)
values ('WELCOME10', '10% off for new students (sample — inactive)', 'percent', 10, 300, 0, false)
on conflict (code) do nothing;
