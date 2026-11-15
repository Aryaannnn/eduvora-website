-- =====================================================================
--  VOICE CALLS + 30-MINUTE SLOTS + BOOKING NOTICE
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql, booking-payment-first.sql and roles.sql / counsellor.sql.)
--
--  1. booking_settings: how long before a slot booking closes
--     (default 60 minutes) — Admin → Settings.
--  2. Every new booking (paid, free or with a package credit) is refused if the
--     slot starts sooner than that. Checked in the database, so it can't be skipped.
--  3. Call tracking on bookings: scheduled / called / no answer / completed + a note.
--  4. slot_calendar(): per date, how many slots exist and how many are still free
--     — for "Fully booked" / "Next available" on the Book a Slot page. Only
--     counts and dates, never who booked.
--  5. convert_future_slots_to_30min(): Admin → Slots button. Replaces only
--     FUTURE slots that were never booked (or attempted) with 30-minute slots.
--  6. Wording in your saved data: package features and the "Why EDUVORA?"
--     card now say 30-minute voice call / call support (only these exact
--     starting phrases are changed — anything you wrote yourself stays).
-- =====================================================================

-- ---------- 1. booking settings (one row) ----------
create table if not exists public.booking_settings (
  id                  integer primary key default 1 check (id = 1),
  min_notice_minutes  integer not null default 60 check (min_notice_minutes between 0 and 2880),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null
);
insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

alter table public.booking_settings enable row level security;
drop policy if exists "booking settings: anyone reads"  on public.booking_settings;
drop policy if exists "booking settings: admin updates" on public.booking_settings;
create policy "booking settings: anyone reads" on public.booking_settings
  for select to anon, authenticated using (true);
create policy "booking settings: admin updates" on public.booking_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.booking_settings from anon, authenticated;
revoke update on public.booking_settings from anon;

create or replace function public.before_booking_settings_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_booking_settings_update on public.booking_settings;
create trigger before_booking_settings_update before update on public.booking_settings
  for each row execute function public.before_booking_settings_update();

create or replace function public.booking_notice_minutes()
returns integer
language sql stable security definer set search_path = public
as $$ select coalesce((select min_notice_minutes from public.booking_settings where id = 1), 60) $$;
grant execute on function public.booking_notice_minutes() to anon, authenticated, service_role;

-- ---------- 2. no booking too close to the start (runs before the slot is taken) ----------
create or replace function public.booking_min_notice()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_start  timestamptz;
  v_notice integer := public.booking_notice_minutes();
begin
  select (s.date + s.start_time) at time zone 'Asia/Kolkata' into v_start from public.slots s where s.id = new.slot_id;
  if v_start is not null and v_start < now() + make_interval(mins => v_notice) then
    raise exception 'This slot starts too soon to book (bookings close % minutes before the start). Please choose a later time.', v_notice;
  end if;
  return new;
end;
$$;
-- "aa_" so it runs BEFORE before_booking_insert takes the slot
drop trigger if exists aa_booking_min_notice on public.bookings;
create trigger aa_booking_min_notice before insert on public.bookings
  for each row execute function public.booking_min_notice();

-- ---------- 3. call tracking ----------
alter table public.bookings add column if not exists call_status text not null default 'scheduled';
alter table public.bookings drop constraint if exists bookings_call_status_check;
alter table public.bookings add constraint bookings_call_status_check
  check (call_status in ('scheduled', 'called', 'no_answer', 'completed'));
alter table public.bookings add column if not exists call_note text;
alter table public.bookings drop constraint if exists bookings_call_note_check;
alter table public.bookings add constraint bookings_call_note_check check (call_note is null or char_length(call_note) <= 1000);
alter table public.bookings add column if not exists call_updated_at timestamptz;
alter table public.bookings add column if not exists call_updated_by uuid references auth.users (id) on delete set null;

-- Staff (admins + counsellors, with 2-step login): set the call status / note.
-- "completed" also marks an upcoming booking completed.
create or replace function public.staff_set_call(p_booking uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sub    text := current_setting('request.jwt.claim.sub', true);
  claims text := current_setting('request.jwt.claims', true);
  me     uuid := auth.uid();
  done   boolean;
begin
  if not public.is_staff() then raise exception 'Only staff can do this.'; end if;
  if p_status is not null and p_status not in ('scheduled', 'called', 'no_answer', 'completed') then raise exception 'Unknown call status.'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'Please keep the note under 1000 characters.'; end if;
  -- the booking rules only let a logged-in non-admin cancel → run this one change as the server
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.bookings set
    call_status     = coalesce(p_status, call_status),
    call_note       = case when p_note is null then call_note else nullif(btrim(p_note), '') end,
    call_updated_at = now(),
    call_updated_by = me,
    status          = case when p_status = 'completed' and status in ('pending', 'confirmed') then 'completed' else status end
   where id = p_booking and status in ('pending', 'confirmed', 'completed');
  done := found;
  perform set_config('request.jwt.claim.sub', coalesce(sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  if not done then raise exception 'Booking not found (or it was cancelled).'; end if;
end;
$$;
revoke all on function public.staff_set_call(uuid, text, text) from public, anon;
grant execute on function public.staff_set_call(uuid, text, text) to authenticated, service_role;

-- Counsellors' safe list of bookings (no amounts) — now with the call status / note.
-- (Same as in roles.sql, plus call_status + call_note; the old Meet link column is gone.)
drop view if exists public.staff_bookings;
create view public.staff_bookings as
select b.id, b.user_id, b.name, b.phone, b.email, b.class_year, b.expected_marks, b.message,
       b.status, b.created_at, b.assigned_to, b.call_status, b.call_note, b.call_updated_at,
       s.date as slot_date, s.start_time as slot_start, s.end_time as slot_end,
       (select count(*) from public.booking_notes n where n.booking_id = b.id) as notes_count
  from public.bookings b
  left join public.slots s on s.id = b.slot_id
 where public.is_staff()
   and b.status not in ('awaiting_payment', 'expired');
revoke all on public.staff_bookings from anon, public;
grant select on public.staff_bookings to authenticated;

-- ---------- 4. calendar summary for the Book a Slot page ----------
-- total = slots that are open or booked (slots you closed yourself don't count)
-- free  = open slots that can still be booked (after the notice period)
create or replace function public.slot_calendar(p_days integer default 60)
returns table (date date, total integer, free integer)
language sql stable security definer set search_path = public
as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select s.date,
         count(*) filter (where s.is_available or exists (
           select 1 from public.bookings b where b.slot_id = s.id and b.status in ('awaiting_payment', 'pending', 'confirmed', 'completed')
         ))::integer as total,
         count(*) filter (where s.is_available
           and (s.date + s.start_time) at time zone 'Asia/Kolkata' > now() + make_interval(mins => public.booking_notice_minutes())
         )::integer as free
    from public.slots s, today
   where s.date between today.d and today.d + least(greatest(coalesce(p_days, 60), 1), 120)
   group by s.date
  having count(*) filter (where s.is_available or exists (
           select 1 from public.bookings b where b.slot_id = s.id and b.status in ('awaiting_payment', 'pending', 'confirmed', 'completed')
         )) > 0
   order by s.date
$$;
revoke all on function public.slot_calendar(integer) from public;
grant execute on function public.slot_calendar(integer) to anon, authenticated, service_role;

-- ---------- 5. Admin → Slots: "Convert future empty slots to 30 minutes" ----------
-- Only FUTURE slots that are not 30 minutes long and have NO booking at all
-- (not even an unpaid attempt) are replaced. Booked / being-paid slots are never touched.
-- Each replaced slot becomes back-to-back 30-minute slots with the same price
-- and the same Open/closed setting, skipping times that overlap a kept slot.
create or replace function public.convert_future_slots_to_30min()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r      record;
  t      time;
  steps  integer;
  n_del  integer := 0;
  n_new  integer := 0;
  n_kept integer := 0;
begin
  if not public.is_admin() then raise exception 'Only admins can do this.'; end if;

  select count(*) into n_kept from public.slots s
   where (s.date + s.start_time) at time zone 'Asia/Kolkata' > now()
     and s.end_time - s.start_time <> interval '30 minutes'
     and exists (select 1 from public.bookings b where b.slot_id = s.id);

  for r in
    select * from public.slots s
     where (s.date + s.start_time) at time zone 'Asia/Kolkata' > now()
       and s.end_time - s.start_time <> interval '30 minutes'
       and not exists (select 1 from public.bookings b where b.slot_id = s.id)
     order by s.date, s.start_time
     for update
  loop
    delete from public.slots where id = r.id;
    n_del := n_del + 1;
    t := r.start_time;
    steps := 0;
    while steps < 48 and t >= r.start_time and t + interval '30 minutes' > t and t + interval '30 minutes' <= r.end_time loop
      insert into public.slots (date, start_time, end_time, price, is_available)
      select r.date, t, t + interval '30 minutes', r.price, r.is_available
       where not exists (
         select 1 from public.slots x
          where x.date = r.date and x.start_time < t + interval '30 minutes' and x.end_time > t
       );
      if found then n_new := n_new + 1; end if;
      t := t + interval '30 minutes';
      steps := steps + 1;
    end loop;
  end loop;
  return jsonb_build_object('removed', n_del, 'created', n_new, 'kept_with_bookings', n_kept);
end;
$$;
revoke all on function public.convert_future_slots_to_30min() from public, anon;
grant execute on function public.convert_future_slots_to_30min() to authenticated, service_role;

-- ---------- 6. wording in saved data (voice call, 30 minutes, no WhatsApp) ----------
-- Only the exact starting phrases are replaced, so running it again changes nothing.
do $$
begin
  if to_regclass('public.products') is not null then
    update public.products set
      description = replace(replace(description,
        'WhatsApp support through counselling', 'call support through counselling'),
        'Unlimited sessions until admission', 'Unlimited 30-minute sessions until admission'),
      details = replace(replace(replace(replace(replace(details::text,
        'WhatsApp support until counselling ends', 'Call support until counselling ends'),
        'Priority WhatsApp support', 'Priority call support'),
        '"1 one-to-one counselling session"', '"1 one-to-one 30-minute counselling session"'),
        '"3 one-to-one counselling sessions"', '"3 one-to-one 30-minute counselling sessions"'),
        '"Unlimited sessions until admission"', '"Unlimited 30-minute sessions until admission"')::jsonb
     where category = 'counselling_package' and details is not null;
  end if;
  if to_regclass('public.why_settings') is not null then
    update public.why_settings
       set cards = replace(cards::text, 'A private video session about YOUR rank', 'A private 30-minute voice call about YOUR rank')::jsonb
     where id = 1;
  end if;
end;
$$;
