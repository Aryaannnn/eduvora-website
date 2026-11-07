-- =====================================================================
--  GOOGLE CALENDAR + GOOGLE MEET for counselling bookings
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  1. google_calendar_connection: the connected Google account (Admin →
--     Settings → "Connect Google Calendar"). The refresh token is stored
--     ENCRYPTED, and this table can ONLY be read by the server (service
--     role) — not by students, not by admins in the browser, not by anon.
--  2. New booking columns: meet_link (shown to the student), and the
--     calendar event id + sync status (for the admin alert).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The connected Google account (one row)
-- ---------------------------------------------------------------------
create table if not exists public.google_calendar_connection (
  id                       integer primary key default 1 check (id = 1),
  google_email             text,
  refresh_token_encrypted  text not null,          -- AES-256-GCM, key only on the server
  scopes                   text,
  connected_by             uuid references auth.users (id) on delete set null,
  connected_at             timestamptz not null default now(),
  last_error               text,                   -- e.g. "access was removed" → reconnect
  last_error_at            timestamptz
);

alter table public.google_calendar_connection enable row level security;
-- No policies at all → nobody can read or change it through the API
-- except the server's service role key (which skips RLS).
revoke all on table public.google_calendar_connection from public, anon, authenticated;
grant all on table public.google_calendar_connection to service_role;

-- ---------------------------------------------------------------------
-- 2. Meet link + calendar event on each booking
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists meet_link          text;
alter table public.bookings add column if not exists calendar_event_id  text;
alter table public.bookings add column if not exists calendar_status    text;   -- ok · manual · failed · not_connected · cancelled
alter table public.bookings add column if not exists calendar_error     text;
alter table public.bookings add column if not exists calendar_synced_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_meet_link_check') then
    alter table public.bookings add constraint bookings_meet_link_check
      check (meet_link is null or (meet_link ~ '^https://[^\s]+$' and char_length(meet_link) <= 300));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_calendar_status_check') then
    alter table public.bookings add constraint bookings_calendar_status_check
      check (calendar_status is null or calendar_status in ('ok', 'manual', 'failed', 'not_connected', 'cancelled'));
  end if;
end $$;

create index if not exists bookings_needs_meet_idx on public.bookings (status)
  where status = 'confirmed' and meet_link is null;

-- Students may cancel their own booking, but never change the Meet link or
-- calendar details (only admins and the server can).
create or replace function public.protect_booking_calendar()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.meet_link          is distinct from old.meet_link
    or new.calendar_event_id  is distinct from old.calendar_event_id
    or new.calendar_status    is distinct from old.calendar_status
    or new.calendar_error     is distinct from old.calendar_error
    or new.calendar_synced_at is distinct from old.calendar_synced_at) then
    raise exception 'You are not allowed to change these booking details.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_booking_calendar on public.bookings;
create trigger protect_booking_calendar
  before update on public.bookings
  for each row execute function public.protect_booking_calendar();
