-- =====================================================================
--  EDUVORA — PREDICTOR ONLY FOR PAID COUNSELLING STUDENTS
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql, predictor.sql and
--  payments.sql. Safe to run again.
--
--  What it does:
--   1. Locks rank_data and college_cutoffs: ONLY admins (and the website's
--      server) can read them. Visitors and students can't.
--   2. Students can no longer save predictions themselves — the server
--      saves them after checking access. They still see their own history.
--   3. Adds Razorpay columns to bookings (online counselling payment).
--   4. Admin "give / remove predictor access" switch per student.
--   5. has_predictor_access() — the one rule used everywhere.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lock the real rank & cutoff data
-- ---------------------------------------------------------------------
drop policy if exists "rank_data: anyone reads"   on public.rank_data;
drop policy if exists "rank_data: admin reads"    on public.rank_data;
drop policy if exists "cutoffs: anyone reads"     on public.college_cutoffs;
drop policy if exists "cutoffs: admin reads"      on public.college_cutoffs;

create policy "rank_data: admin reads" on public.rank_data
  for select to authenticated using (public.is_admin());
create policy "cutoffs: admin reads" on public.college_cutoffs
  for select to authenticated using (public.is_admin());

-- Visitors (anon) get no table access at all
revoke all on public.rank_data       from anon;
revoke all on public.college_cutoffs from anon;


-- ---------------------------------------------------------------------
-- 2. Predictions: students READ their own; only the server/admin WRITES
-- ---------------------------------------------------------------------
drop policy if exists "predictions: save own" on public.predictions;
revoke insert, update on public.predictions from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Online (Razorpay) payment details on counselling bookings
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists amount              integer check (amount is null or amount >= 0);
alter table public.bookings add column if not exists razorpay_order_id   text unique;
alter table public.bookings add column if not exists razorpay_payment_id text unique;
alter table public.bookings add column if not exists paid_at             timestamptz;
alter table public.bookings add column if not exists invoice_number      text unique;
alter table public.bookings add column if not exists hold_expires_at     timestamptz;
alter table public.bookings add column if not exists expected_marks      numeric(5,2);
alter table public.bookings add column if not exists class_year          text;

-- @@BOOKING_TRIGGERS_START@@
-- New bookings: students can't pre-fill payment fields; the slot is taken atomically
create or replace function public.before_booking_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id             := auth.uid();
    new.status              := 'pending';
    new.payment_status      := 'unpaid';
    new.amount              := null;   -- payment fields are set only by the server
    new.razorpay_order_id   := null;
    new.razorpay_payment_id := null;
    new.paid_at             := null;
    new.invoice_number      := null;
    new.hold_expires_at     := null;
  end if;

  update public.slots
     set is_available = false
   where id = new.slot_id and is_available and date >= current_date;

  if not found then
    raise exception 'This slot is no longer available. Please choose another one.';
  end if;
  return new;
end;
$$;

drop trigger if exists before_booking_insert on public.bookings;
create trigger before_booking_insert
  before insert on public.bookings
  for each row execute function public.before_booking_insert();

-- Students may only CANCEL; cancelling or an expired hold frees the slot again
create or replace function public.before_booking_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.user_id <> old.user_id
       or new.slot_id <> old.slot_id
       or new.payment_status      is distinct from old.payment_status
       or new.amount              is distinct from old.amount
       or new.razorpay_order_id   is distinct from old.razorpay_order_id
       or new.razorpay_payment_id is distinct from old.razorpay_payment_id
       or new.paid_at             is distinct from old.paid_at
       or new.invoice_number      is distinct from old.invoice_number
       or new.hold_expires_at     is distinct from old.hold_expires_at then
      raise exception 'You are not allowed to change these booking details.';
    end if;
    if new.status is distinct from old.status
       and not (new.status = 'cancelled' and old.status in ('pending', 'confirmed')) then
      raise exception 'You can only cancel a booking.';
    end if;
  end if;

  if new.status in ('cancelled', 'expired') and old.status not in ('cancelled', 'expired') then
    update public.slots set is_available = true
     where id = old.slot_id and date >= current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists before_booking_update on public.bookings;
create trigger before_booking_update
  before update on public.bookings
  for each row execute function public.before_booking_update();
-- @@BOOKING_TRIGGERS_END@@

-- Server marks a counselling payment as paid (only once), confirms the booking and
-- gives it an invoice number (needs payments.sql). Same as booking-payment-first.sql.
create or replace function public.mark_booking_paid(p_order_id text, p_payment_id text)
returns setof public.bookings
language plpgsql security definer set search_path = public
as $$
declare b public.bookings; v_status text;
begin
  select * into b from public.bookings where razorpay_order_id = p_order_id for update;
  if not found then return; end if;
  if b.payment_status = 'paid' then return next b; return; end if;

  v_status := b.status;
  if b.status in ('expired', 'cancelled') then
    update public.slots set is_available = false where id = b.slot_id and is_available;
    v_status := case when found then 'confirmed' else 'pending' end;
  elsif b.status in ('awaiting_payment', 'pending') then
    v_status := 'confirmed';
  end if;

  update public.bookings
     set status = v_status,
         payment_status = 'paid',
         razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
         paid_at = coalesce(paid_at, now()),
         hold_expires_at = null,
         invoice_number = coalesce(invoice_number, public.next_invoice_number())
   where id = b.id
  returning * into b;
  return next b;
end;
$$;
revoke all on function public.mark_booking_paid(text, text) from public, anon, authenticated;
grant execute on function public.mark_booking_paid(text, text) to service_role;


-- ---------------------------------------------------------------------
-- 4. Admin override: give or remove access by hand (e.g. offline payment)
--    has_access = true  → always allowed
--    has_access = false → never allowed (even with a paid booking)
--    no row             → automatic (paid counselling booking)
-- ---------------------------------------------------------------------
create table if not exists public.predictor_access_overrides (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  has_access  boolean not null,
  note        text check (note is null or char_length(note) <= 300),
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.predictor_access_overrides enable row level security;

drop policy if exists "overrides: admin all" on public.predictor_access_overrides;
create policy "overrides: admin all" on public.predictor_access_overrides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.predictor_access_overrides from anon;


-- ---------------------------------------------------------------------
-- 5. THE RULE: who may use the predictor?
--    ✓ admins
--    ✓ admin override = give access
--    ✓ at least one counselling booking that is PAID and confirmed/completed
--      (cancelled or refunded bookings don't count)
--    ✗ admin override = remove access
--  A student can only check themselves; admins/server can check anyone.
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
  );
end;
$$;
revoke all on function public.has_predictor_access(uuid) from public, anon;
grant execute on function public.has_predictor_access(uuid) to authenticated, service_role;
