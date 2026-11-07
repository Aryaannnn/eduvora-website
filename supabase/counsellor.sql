-- =====================================================================
--  COUNSELLOR STAFF ROLE
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Run AFTER admin-security.sql and leads.sql. Then run leads.sql ONCE MORE
--  (so staff accounts are never listed as leads).
--
--  Roles: student · parent · counsellor · admin  (only admins change roles)
--
--  Counsellors (with 2-step login, like admins) can:
--    • Bookings  — see them WITHOUT amounts/payment details (staff_bookings
--                  view), mark a session completed, add notes
--    • Leads     — see them, change status / follow-up, add notes
--    • Students  — see the list WITHOUT any payment info (staff_students view)
--    • Enquiries — see them and change the status (not delete)
--  They can NOT read purchases, payments, revenue, coupons, settings, the
--  activity log or other tables — every one of those still needs is_admin().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The new role
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'parent', 'counsellor', 'admin'));

-- Counsellor with a 2-step login
create or replace function public.is_counsellor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'counsellor')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
-- Admin OR counsellor, with a 2-step login
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'counsellor'))
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
grant execute on function public.is_counsellor(), public.is_staff() to authenticated;

-- (Only admins can change anyone's role — protect_profile_role in setup.sql stays.)

-- ---------------------------------------------------------------------
-- 2. "Assigned to" a counsellor (bookings and leads)
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.leads    add column if not exists assigned_to uuid references auth.users (id) on delete set null;
create index if not exists bookings_assigned_idx on public.bookings (assigned_to) where assigned_to is not null;
create index if not exists leads_assigned_idx    on public.leads (assigned_to) where assigned_to is not null;

-- Only staff can be assigned; only admins may assign
create or replace function public.check_assigned_to()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.assigned_to is distinct from old.assigned_to then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only admins can assign to a counsellor.';
    end if;
    if new.assigned_to is not null
       and not exists (select 1 from public.profiles where id = new.assigned_to and role in ('admin', 'counsellor')) then
      raise exception 'You can only assign to a counsellor or admin.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists check_assigned_to on public.bookings;
create trigger check_assigned_to before update on public.bookings
  for each row execute function public.check_assigned_to();
drop trigger if exists check_assigned_to on public.leads;
create trigger check_assigned_to before update on public.leads
  for each row execute function public.check_assigned_to();

-- ---------------------------------------------------------------------
-- 3. Bookings for staff — NO amounts, payment status, invoice or Razorpay ids.
--    (Counsellors get no access to the bookings table itself.)
-- ---------------------------------------------------------------------
create table if not exists public.booking_notes (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists booking_notes_booking_idx on public.booking_notes (booking_id, created_at desc);
alter table public.booking_notes enable row level security;
drop policy if exists "booking notes: staff read"   on public.booking_notes;
drop policy if exists "booking notes: staff write"  on public.booking_notes;
drop policy if exists "booking notes: delete own"   on public.booking_notes;
create policy "booking notes: staff read" on public.booking_notes
  for select to authenticated using (public.is_staff());
create policy "booking notes: staff write" on public.booking_notes
  for insert to authenticated with check (public.is_staff());
create policy "booking notes: delete own" on public.booking_notes
  for delete to authenticated using (public.is_admin() or (public.is_staff() and created_by = auth.uid()));
revoke all on table public.booking_notes from anon;

create or replace function public.before_staff_note_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists before_staff_note_insert on public.booking_notes;
create trigger before_staff_note_insert before insert on public.booking_notes
  for each row execute function public.before_staff_note_insert();

-- The safe list (a view that runs with its owner's rights, filtered to staff)
drop view if exists public.staff_bookings;
create view public.staff_bookings as
select b.id, b.user_id, b.name, b.phone, b.email, b.class_year, b.expected_marks, b.message,
       b.status, b.created_at, b.meet_link, b.assigned_to,
       s.date as slot_date, s.start_time as slot_start, s.end_time as slot_end,
       (select count(*) from public.booking_notes n where n.booking_id = b.id) as notes_count
  from public.bookings b
  left join public.slots s on s.id = b.slot_id
 where public.is_staff()
   and b.status not in ('awaiting_payment', 'expired');
revoke all on public.staff_bookings from anon, public;
grant select on public.staff_bookings to authenticated;

-- Staff: mark a session completed
create or replace function public.staff_complete_booking(p_booking uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  sub    text := current_setting('request.jwt.claim.sub', true);
  claims text := current_setting('request.jwt.claims', true);
  done   boolean;
begin
  if not public.is_staff() then raise exception 'Only staff can do this.'; end if;
  -- The booking rules (before_booking_update) only let a logged-in non-admin
  -- CANCEL. Staff were checked above, so this one change runs as the server.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.bookings set status = 'completed'
   where id = p_booking and status in ('pending', 'confirmed');
  done := found;
  perform set_config('request.jwt.claim.sub', coalesce(sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  if not done then raise exception 'Only upcoming (pending / confirmed) sessions can be marked completed.'; end if;
end;
$$;
revoke all on function public.staff_complete_booking(uuid) from public, anon;
grant execute on function public.staff_complete_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Students for staff — NO payment info (profiles of students/parents only)
-- ---------------------------------------------------------------------
drop view if exists public.staff_students;
create view public.staff_students as
select p.id, p.full_name, p.email, p.phone, p.role, p.created_at,
       (select count(*) from public.bookings b
         where b.user_id = p.id and b.status in ('pending', 'confirmed', 'completed')) as sessions_booked
  from public.profiles p
 where public.is_staff()
   and p.role in ('student', 'parent');
revoke all on public.staff_students from anon, public;
grant select on public.staff_students to authenticated;

-- Staff names (for "Assigned to")
drop view if exists public.staff_members;
create view public.staff_members as
select p.id, p.full_name, p.email, p.role
  from public.profiles p
 where public.is_staff() and p.role in ('admin', 'counsellor');
revoke all on public.staff_members from anon, public;
grant select on public.staff_members to authenticated;

-- ---------------------------------------------------------------------
-- 5. Leads: counsellors read + change status / follow-up + notes
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.leads') is null then
    raise exception 'Run supabase/leads.sql first, then this file.';
  end if;
end $$;

drop policy if exists "leads: counsellor reads"   on public.leads;
drop policy if exists "leads: counsellor updates" on public.leads;
create policy "leads: counsellor reads" on public.leads
  for select to authenticated using (public.is_counsellor());
create policy "leads: counsellor updates" on public.leads
  for update to authenticated using (public.is_counsellor()) with check (public.is_counsellor());

create or replace function public.counsellor_lead_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.user_id is distinct from old.user_id or new.email is distinct from old.email
    or new.phone is distinct from old.phone or new.name is distinct from old.name
    or new.class_year is distinct from old.class_year or new.predicted_rank is distinct from old.predicted_rank
    or new.sources is distinct from old.sources or new.first_seen_at is distinct from old.first_seen_at
    or new.last_activity_at is distinct from old.last_activity_at) then
    raise exception 'Counsellors can only change the status and follow-up date.';
  end if;
  return new;
end;
$$;
drop trigger if exists counsellor_lead_guard on public.leads;
create trigger counsellor_lead_guard before update on public.leads
  for each row execute function public.counsellor_lead_guard();

drop policy if exists "lead notes: counsellor reads"  on public.lead_notes;
drop policy if exists "lead notes: counsellor writes" on public.lead_notes;
drop policy if exists "lead notes: counsellor deletes own" on public.lead_notes;
create policy "lead notes: counsellor reads" on public.lead_notes
  for select to authenticated using (public.is_counsellor());
create policy "lead notes: counsellor writes" on public.lead_notes
  for insert to authenticated with check (public.is_counsellor());
create policy "lead notes: counsellor deletes own" on public.lead_notes
  for delete to authenticated using (public.is_counsellor() and created_by = auth.uid());

-- ---------------------------------------------------------------------
-- 6. Enquiries: counsellors read + change status (no delete)
-- ---------------------------------------------------------------------
drop policy if exists "enquiries: counsellor reads"   on public.enquiries;
drop policy if exists "enquiries: counsellor updates" on public.enquiries;
create policy "enquiries: counsellor reads" on public.enquiries
  for select to authenticated using (public.is_counsellor());
create policy "enquiries: counsellor updates" on public.enquiries
  for update to authenticated using (public.is_counsellor()) with check (public.is_counsellor());

create or replace function public.counsellor_enquiry_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Counsellors can only change the enquiry status.';
  end if;
  return new;
end;
$$;
drop trigger if exists counsellor_enquiry_guard on public.enquiries;
create trigger counsellor_enquiry_guard before update on public.enquiries
  for each row execute function public.counsellor_enquiry_guard();

-- ---------------------------------------------------------------------
-- 7. Staff accounts are not leads
-- ---------------------------------------------------------------------
delete from public.leads l using public.profiles p
 where p.id = l.user_id and p.role in ('admin', 'counsellor');
