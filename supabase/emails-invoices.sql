-- =====================================================================
--  EDUVORA — EMAILS (Resend) + INVOICES + ADMIN RESCHEDULE
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER booking-payment-first.sql. Safe to run again.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Email log (every email we send — failed ones can be resent by admin)
-- ---------------------------------------------------------------------
create table if not exists public.email_logs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,          -- e.g. payment_success, booking_confirmed, reminder_24h …
  ref_id      text,                   -- the purchase / booking / enquiry / user it is about
  to_email    text not null,
  subject     text not null,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  resend_id   text,                   -- Resend's message id
  attempts    integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_logs_created_idx on public.email_logs (created_at desc);
create index if not exists email_logs_status_idx  on public.email_logs (status);

alter table public.email_logs enable row level security;
drop policy if exists "email_logs: admin reads" on public.email_logs;
create policy "email_logs: admin reads" on public.email_logs
  for select to authenticated using (public.is_admin());
revoke all on public.email_logs from anon;
-- (only the website's server writes to this table)

-- ---------------------------------------------------------------------
-- 2. "Already emailed?" markers — so each email is sent only once,
--    even if the browser, the webhook and the automatic check all report
--    the same payment.
-- ---------------------------------------------------------------------
alter table public.purchases add column if not exists payment_method        text;  -- upi / card / netbanking …
alter table public.purchases add column if not exists receipt_email_sent_at  timestamptz;

alter table public.bookings add column if not exists payment_method              text;
alter table public.bookings add column if not exists confirmation_email_sent_at  timestamptz;
alter table public.bookings add column if not exists reminder_24h_sent_at        timestamptz;
alter table public.bookings add column if not exists reminder_1h_sent_at         timestamptz;

alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;

-- Existing students/payments/bookings should NOT get "welcome"/"receipt" emails now
update public.profiles  set welcome_email_sent_at      = now() where welcome_email_sent_at is null;
update public.purchases set receipt_email_sent_at      = now() where receipt_email_sent_at is null and status = 'paid';
update public.bookings  set confirmation_email_sent_at = now() where confirmation_email_sent_at is null and payment_status = 'paid';

-- Students can't fake these markers on their own profile
create or replace function public.protect_profile_email_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.welcome_email_sent_at := old.welcome_email_sent_at;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_email_flags on public.profiles;
create trigger protect_profile_email_flags before update on public.profiles
  for each row execute function public.protect_profile_email_flags();

create index if not exists bookings_reminder_idx on public.bookings (status, payment_status)
  where reminder_1h_sent_at is null;

-- ---------------------------------------------------------------------
-- 3. Admin: move a booking to another free slot (old slot is freed)
-- ---------------------------------------------------------------------
create or replace function public.reschedule_booking(p_booking uuid, p_new_slot uuid)
returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare b public.bookings;
begin
  if not public.is_admin() then raise exception 'Only admins can reschedule bookings.'; end if;

  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found.'; end if;
  if b.status not in ('pending', 'confirmed') then raise exception 'Only upcoming bookings can be rescheduled.'; end if;
  if b.slot_id = p_new_slot then return b; end if;

  update public.slots set is_available = false
   where id = p_new_slot and is_available and date >= current_date;
  if not found then raise exception 'That new time slot is not available.'; end if;

  update public.slots set is_available = true where id = b.slot_id and date >= current_date;

  update public.bookings
     set slot_id = p_new_slot,
         status = 'confirmed',
         reminder_24h_sent_at = null,
         reminder_1h_sent_at = null
   where id = b.id
  returning * into b;
  return b;
end;
$$;
revoke all on function public.reschedule_booking(uuid, uuid) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated, service_role;
