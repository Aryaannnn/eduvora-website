-- =====================================================================
--  EDUVORA — COUNSELLING: PAY FIRST, THEN BOOKED
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql, payments.sql and
--  predictor-access.sql. Safe to run again.
--
--  How booking works now:
--   1. Student clicks "Pay & Book" → the server quietly HOLDS the slot for
--      10 minutes (booking status 'awaiting_payment' — hidden everywhere).
--   2. Payment verified → 'confirmed' + 'paid' + invoice number. Only now it
--      appears in My Bookings / Admin Bookings.
--   3. Popup closed / payment failed / 10 minutes passed → 'expired'
--      (hidden) and the slot is free again at once.
--  Students can no longer create bookings directly — only the server can,
--  and only through hold_slot() below.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. New columns + statuses
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists amount              integer check (amount is null or amount >= 0);
alter table public.bookings add column if not exists razorpay_order_id   text unique;
alter table public.bookings add column if not exists razorpay_payment_id text unique;
alter table public.bookings add column if not exists paid_at             timestamptz;
alter table public.bookings add column if not exists class_year          text check (class_year is null or char_length(class_year) <= 40);
alter table public.bookings add column if not exists expected_marks      numeric(5,2) check (expected_marks is null or expected_marks between 0 and 125);
alter table public.bookings add column if not exists hold_expires_at     timestamptz;
alter table public.bookings add column if not exists invoice_number      text unique;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('awaiting_payment', 'pending', 'confirmed', 'cancelled', 'completed', 'expired'));

create index if not exists bookings_hold_idx on public.bookings (hold_expires_at) where status = 'awaiting_payment';


-- ---------------------------------------------------------------------
-- 2. Triggers (same as setup.sql — kept in sync)
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- 3. Only the server creates bookings now (students: read + cancel own)
-- ---------------------------------------------------------------------
drop policy if exists "bookings: create own"   on public.bookings;
drop policy if exists "bookings: admin insert" on public.bookings;
create policy "bookings: admin insert" on public.bookings
  for insert to authenticated with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 4. Holds
-- ---------------------------------------------------------------------
-- Release holds older than 10 minutes (anyone may run it — it only frees slots)
create or replace function public.release_expired_holds()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  update public.bookings
     set status = 'expired',
         payment_status = case when payment_status = 'pending' then 'unpaid' else payment_status end,
         hold_expires_at = null
   where status = 'awaiting_payment' and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.release_expired_holds() from public;
grant execute on function public.release_expired_holds() to anon, authenticated, service_role;

-- Quietly hold a slot for 10 minutes while the student pays (server only).
-- Two students can never hold the same slot: the insert trigger takes the
-- slot atomically and raises "no longer available" for the second one.
create or replace function public.hold_slot(
  p_user uuid, p_slot uuid, p_name text, p_phone text, p_email text,
  p_class_year text, p_expected_marks numeric, p_message text
)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare v_price integer; b public.bookings;
begin
  perform public.release_expired_holds();

  -- A new try replaces this student's own earlier unpaid holds (frees those slots)
  update public.bookings
     set status = 'expired', payment_status = case when payment_status = 'pending' then 'unpaid' else payment_status end, hold_expires_at = null
   where user_id = p_user and status = 'awaiting_payment';

  select price into v_price from public.slots where id = p_slot;
  if v_price is null then
    raise exception 'This slot is no longer available. Please choose another one.';
  end if;

  insert into public.bookings (user_id, slot_id, name, phone, email, class_year, expected_marks, message,
                               status, payment_status, amount, hold_expires_at)
  values (p_user, p_slot, p_name, p_phone, nullif(p_email, ''), nullif(p_class_year, ''), p_expected_marks, nullif(p_message, ''),
          case when v_price > 0 then 'awaiting_payment' else 'confirmed' end,   -- free slots are booked at once
          case when v_price > 0 then 'pending' else 'unpaid' end,
          v_price,
          case when v_price > 0 then now() + interval '10 minutes' end)
  returning * into b;
  return b;
end;
$$;
revoke all on function public.hold_slot(uuid, uuid, text, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.hold_slot(uuid, uuid, text, text, text, text, numeric, text) to service_role;


-- ---------------------------------------------------------------------
-- 5. Payment verified → booked (only once), with an invoice number.
--    Paid AFTER the hold ran out: take the slot back if it's still free;
--    if someone else booked it, keep it 'pending' + paid so the admin can
--    reschedule or refund (it shows in Admin → Bookings).
-- ---------------------------------------------------------------------
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
-- 6. ONE-TIME CLEAN-UP of old unpaid "reserved" test bookings
--    (pending + not paid → expired; their future slots become free again)
-- ---------------------------------------------------------------------
update public.bookings
   set status = 'expired',
       payment_status = case when payment_status = 'paid' then payment_status else 'unpaid' end,
       hold_expires_at = null
 where status = 'pending' and payment_status <> 'paid';
