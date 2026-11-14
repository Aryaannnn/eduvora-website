-- =====================================================================
--  ROLES: Student · Counsellor · Admin — run this ONE file once.
--  Supabase → SQL Editor → New query → paste this WHOLE file → Run.
--  Safe to run again. (Needs setup.sql, admin-security.sql and leads.sql.)
--
--  After this, every role change is done in Admin → Students (no SQL):
--   PART 1  the 'counsellor' role + what counsellors may see (same as
--           counsellor.sql — you don't need to run that one separately)
--   PART 2  Leads updated so staff accounts are never leads (same as the
--           latest leads.sql)
--   PART 3  role security: roles change ONLY through the website's server
--           after an admin check; the last admin is protected; every
--           change is written to the Activity Log
--  ⚙️ Generated from counsellor.sql + leads.sql + roles-security.part.sql
-- =====================================================================

-- #####################################################################
-- PART 1 — counsellor role and counsellor access
-- #####################################################################

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


-- #####################################################################
-- PART 2 — leads (staff accounts excluded)
-- #####################################################################

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users (id) on delete set null,
  email              text,                 -- lower-case
  phone              text,                 -- last 10 digits
  name               text,
  class_year         text,
  predicted_rank     text,                 -- e.g. "12,000 – 18,000"
  sources            text[] not null default '{}',
  status             text not null default 'new'
                     check (status in ('new', 'contacted', 'interested', 'paid', 'not_interested')),
  follow_up_on       date,
  first_seen_at      timestamptz not null default now(),
  last_activity_at   timestamptz not null default now(),
  status_changed_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists leads_user_uidx  on public.leads (user_id) where user_id is not null;
create unique index if not exists leads_email_uidx on public.leads (email)   where email is not null;
create unique index if not exists leads_phone_uidx on public.leads (phone)   where phone is not null;
create index if not exists leads_status_idx   on public.leads (status);
create index if not exists leads_followup_idx on public.leads (follow_up_on) where follow_up_on is not null;
create index if not exists leads_activity_idx on public.leads (last_activity_at desc);

create table if not exists public.lead_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);

create table if not exists public.lead_sync_state (
  id         integer primary key default 1 check (id = 1),
  synced_at  timestamptz
);
insert into public.lead_sync_state (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Security: admins (2-step) only
-- ---------------------------------------------------------------------
alter table public.leads           enable row level security;
alter table public.lead_notes      enable row level security;
alter table public.lead_sync_state enable row level security;

drop policy if exists "leads: admin all"      on public.leads;
drop policy if exists "lead notes: admin all" on public.lead_notes;
create policy "leads: admin all" on public.leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lead notes: admin all" on public.lead_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.leads, public.lead_notes, public.lead_sync_state from anon;
revoke all on table public.lead_sync_state from authenticated;

-- Admins may only change the pipeline (status, follow-up), not the collected details
create or replace function public.before_lead_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists before_lead_update on public.leads;
create trigger before_lead_update before update on public.leads
  for each row execute function public.before_lead_update();

create or replace function public.before_lead_note_insert()
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
drop trigger if exists before_lead_note_insert on public.lead_notes;
create trigger before_lead_note_insert before insert on public.lead_notes
  for each row execute function public.before_lead_note_insert();

-- ---------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------
-- Admin or counsellor with a 2-step login (same as in counsellor.sql)
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'counsellor'))
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.lead_email(e text) returns text
language sql immutable as $$
  select case when e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(btrim(e)) end
$$;
create or replace function public.lead_phone(p text) returns text
language sql immutable as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10
              then right(regexp_replace(p, '\D', '', 'g'), 10) end
$$;
create or replace function public.lead_status_rank(s text) returns integer
language sql immutable as $$
  select case s when 'paid' then 4 when 'interested' then 3 when 'contacted' then 2 when 'not_interested' then 1 else 0 end
$$;

-- ---------------------------------------------------------------------
-- 4. Collect + merge.  p_full = true → look at everything again.
-- ---------------------------------------------------------------------
create or replace function public.sync_leads(p_full boolean default false)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  since   timestamptz;
  r       record;
  ids     uuid[];
  keep    uuid;
  other   public.leads;
  n       integer := 0;
begin
  -- Only staff (admins / counsellors with 2-step login) and the server
  if not (public.is_staff() or coalesce(auth.jwt() ->> 'role', '') in ('service_role', '')) then
    raise exception 'Only admins can sync leads.';
  end if;
  -- one sync at a time
  perform 1 from public.lead_sync_state where id = 1 for update;
  since := case when p_full then '-infinity'::timestamptz
                else coalesce((select synced_at from public.lead_sync_state where id = 1) - interval '1 hour', '-infinity'::timestamptz) end;

  for r in
    with src as (
      -- new signups (not admins)
      select p.id as user_id, p.email, p.phone, p.full_name as name, null::text as class_year, null::text as rank,
             'signup'::text as source, p.created_at as at
        from public.profiles p where p.role not in ('admin', 'counsellor')
      union all
      -- contact / unlock enquiries
      select e.user_id, e.email, e.phone, e.name, e.class_year, null, 'enquiry', e.created_at
        from public.enquiries e
      union all
      -- rank predictor users
      select pr.user_id, p.email, p.phone, p.full_name, null,
             case when pr.entered_rank is not null then 'Rank ' || to_char(pr.entered_rank, 'FM999,999,999')
                  else to_char(pr.predicted_min_rank, 'FM999,999,999') || ' – ' || to_char(pr.predicted_max_rank, 'FM999,999,999') end,
             'predictor', pr.created_at
        from public.predictions pr join public.profiles p on p.id = pr.user_id
       where p.role not in ('admin', 'counsellor')
      union all
      -- free resources: free products (₹0 unlock) and free tests
      select pu.user_id, p.email, p.phone, p.full_name, null, null, 'free_resource', pu.created_at
        from public.purchases pu join public.profiles p on p.id = pu.user_id
       where pu.status = 'paid' and pu.amount = 0 and p.role not in ('admin', 'counsellor')
      union all
      select ta.user_id, p.email, p.phone, p.full_name, null, null, 'free_resource', ta.started_at
        from public.test_attempts ta join public.tests t on t.id = ta.test_id join public.profiles p on p.id = ta.user_id
       where t.is_free and p.role not in ('admin', 'counsellor')
      union all
      -- abandoned / failed payments (products)
      select pu.user_id, p.email, p.phone, p.full_name, null, null, 'abandoned_payment', pu.created_at
        from public.purchases pu join public.profiles p on p.id = pu.user_id
       where pu.status in ('created', 'pending', 'failed', 'abandoned') and p.role not in ('admin', 'counsellor')
      union all
      -- counselling: unpaid attempts → abandoned; real bookings → booking
      select b.user_id, coalesce(b.email, p.email), b.phone, b.name, b.class_year, null,
             case when b.status = 'expired' or b.payment_status = 'failed' then 'abandoned_payment' else 'booking' end,
             coalesce(b.paid_at, b.created_at)
        from public.bookings b left join public.profiles p on p.id = b.user_id
       where b.status <> 'awaiting_payment' and coalesce(p.role, 'student') not in ('admin', 'counsellor')   -- deleted accounts: no user, email or phone left → skipped below
    )
    select user_id, public.lead_email(email) as email, public.lead_phone(phone) as phone,
           nullif(btrim(name), '') as name, nullif(btrim(class_year), '') as class_year, rank, source, at
      from src
     where at > since
       and (user_id is not null or public.lead_email(email) is not null or public.lead_phone(phone) is not null)
     order by at
  loop
    select array_agg(id order by first_seen_at, created_at) into ids
      from public.leads
     where (r.user_id is not null and user_id = r.user_id)
        or (r.email   is not null and email   = r.email)
        or (r.phone   is not null and phone   = r.phone);

    if ids is null then
      insert into public.leads (user_id, email, phone, name, class_year, predicted_rank, sources, first_seen_at, last_activity_at)
      values (r.user_id, r.email, r.phone, r.name, r.class_year, r.rank, array[r.source], r.at, r.at);
    else
      keep := ids[1];
      -- the same person appeared as 2+ leads (e.g. enquiry by phone, then signup) → merge into the oldest
      for other in select * from public.leads where id = any (ids[2:]) loop
        update public.lead_notes set lead_id = keep where lead_id = other.id;
        delete from public.leads where id = other.id;
        update public.leads k set
          user_id          = coalesce(k.user_id, other.user_id),
          email            = coalesce(k.email, other.email),
          phone            = coalesce(k.phone, other.phone),
          name             = coalesce(k.name, other.name),
          class_year       = coalesce(k.class_year, other.class_year),
          predicted_rank   = coalesce(k.predicted_rank, other.predicted_rank),
          sources          = (select array_agg(distinct s) from unnest(k.sources || other.sources) s),
          status           = case when public.lead_status_rank(other.status) > public.lead_status_rank(k.status) then other.status else k.status end,
          follow_up_on     = case when k.follow_up_on is null then other.follow_up_on
                                  when other.follow_up_on is null then k.follow_up_on
                                  else least(k.follow_up_on, other.follow_up_on) end,
          first_seen_at    = least(k.first_seen_at, other.first_seen_at),
          last_activity_at = greatest(k.last_activity_at, other.last_activity_at)
         where k.id = keep;
      end loop;

      update public.leads k set
        user_id          = coalesce(k.user_id, r.user_id),
        email            = coalesce(k.email, r.email),
        phone            = coalesce(k.phone, r.phone),
        name             = case when r.source = 'signup' and r.name is not null then r.name else coalesce(k.name, r.name) end,
        class_year       = coalesce(r.class_year, k.class_year),          -- newest wins
        predicted_rank   = coalesce(r.rank, k.predicted_rank),            -- newest wins
        sources          = case when r.source = any (k.sources) then k.sources else k.sources || r.source end,
        first_seen_at    = least(k.first_seen_at, r.at),
        last_activity_at = greatest(k.last_activity_at, r.at)
       where k.id = keep;
    end if;
    n := n + 1;
  end loop;

  -- Anyone who has paid → 'paid'
  update public.leads l set status = 'paid'
   where l.status <> 'paid'
     and (   (l.user_id is not null and exists (select 1 from public.purchases pu where pu.user_id = l.user_id and pu.status = 'paid' and pu.amount > 0))
          or (l.user_id is not null and exists (select 1 from public.bookings b where b.user_id = l.user_id and b.payment_status = 'paid'))
          or (l.email is not null and exists (select 1 from public.bookings b where lower(b.email) = l.email and b.payment_status = 'paid')));

  update public.lead_sync_state set synced_at = now() where id = 1;
  return n;
end;
$$;
revoke all on function public.sync_leads(boolean) from public, anon;
grant execute on function public.sync_leads(boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Leads + total paid (₹) for the admin page (reads with the admin's rights)
-- ---------------------------------------------------------------------
drop view if exists public.leads_overview;  -- recreated (columns may have been added, e.g. assigned_to)
create view public.leads_overview with (security_invoker = true) as
select l.*,
       coalesce((select sum(pu.amount) from public.purchases pu
                  where l.user_id is not null and pu.user_id = l.user_id and pu.status = 'paid'), 0)
     + coalesce((select sum(coalesce(b.amount, 0)) from public.bookings b
                  where b.payment_status = 'paid'
                    and ((l.user_id is not null and b.user_id = l.user_id)
                      or (l.user_id is null and l.email is not null and lower(b.email) = l.email))), 0) as total_paid,
       (select count(*) from public.lead_notes n where n.lead_id = l.id) as notes_count
  from public.leads l;
revoke all on public.leads_overview from anon;
grant select on public.leads_overview to authenticated, service_role;

-- First fill (everything collected so far)
select public.sync_leads(true);


-- #####################################################################
-- PART 3 — role security
-- #####################################################################
-- ---------------------------------------------------------------------
-- ROLE SECURITY — roles change ONLY through the website's server
-- ---------------------------------------------------------------------
-- 1. Nobody can change a role through the database API — not students,
--    not counsellors, not even admins in the browser. Only the website's
--    server (service role), after checking that the person is an admin,
--    via change_user_role() below. (Supabase dashboard / SQL editor too.)
create or replace function public.protect_profile_role()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') not in ('service_role', '') then
    raise exception 'Roles can only be changed by an admin in Admin → Students.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 2. There must always be at least one admin
create or replace function public.keep_one_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role is distinct from 'admin')
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'This is the last admin — make someone else an admin first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin
  before update of role or delete on public.profiles
  for each row execute function public.keep_one_admin();

-- 3. The one way to change a role (called by the website's server only)
--    Safety rules: valid role · an admin can't change their own role ·
--    the last admin can't be changed · making an admin needs their email
--    typed exactly · every change goes to Admin → Activity Log.
create or replace function public.change_user_role(p_user uuid, p_new_role text, p_actor uuid, p_confirm_email text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  actor public.profiles;
  target public.profiles;
  old_role text;
begin
  if p_new_role not in ('student', 'parent', 'counsellor', 'admin') then raise exception 'Unknown role.'; end if;
  select * into actor from public.profiles where id = p_actor;
  if not found or actor.role <> 'admin' then raise exception 'Only admins can change roles.'; end if;
  if p_user = p_actor then raise exception 'You can''t change your own role (so you don''t lock yourself out).'; end if;

  -- lock all admins, so two changes at the same moment can't remove the last one
  perform 1 from public.profiles where role = 'admin' for update;
  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'User not found.'; end if;
  old_role := target.role;
  if old_role = p_new_role then
    return jsonb_build_object('changed', false, 'old_role', old_role, 'new_role', p_new_role);
  end if;
  if p_new_role = 'admin' and lower(btrim(coalesce(p_confirm_email, ''))) is distinct from lower(btrim(coalesce(target.email, '')))
     then raise exception 'To make someone an admin, type their email address exactly.';
  end if;
  if old_role = 'admin' and not exists (select 1 from public.profiles where role = 'admin' and id <> target.id) then
    raise exception 'This is the last admin — make someone else an admin first.';
  end if;

  update public.profiles set role = p_new_role where id = target.id;

  -- Staff aren't leads; work assigned to someone who is no longer staff is un-assigned
  if p_new_role in ('admin', 'counsellor') and to_regclass('public.leads') is not null then
    execute 'delete from public.leads where user_id = $1' using target.id;
  end if;
  if p_new_role not in ('admin', 'counsellor') then
    if to_regclass('public.leads') is not null then execute 'update public.leads set assigned_to = null where assigned_to = $1' using target.id; end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'assigned_to') then
      execute 'update public.bookings set assigned_to = null where assigned_to = $1' using target.id;
    end if;
  end if;

  -- Activity Log (admin-security.sql)
  if to_regclass('public.admin_activity') is not null then
    insert into public.admin_activity (admin_id, admin_name, action, entity, entity_id, summary, details)
    values (actor.id, coalesce(nullif(actor.full_name, ''), actor.email, 'Admin'), 'user.role', 'profiles', target.id::text,
            left(format('Changed role of %s: %s → %s', coalesce(nullif(target.full_name, ''), target.email, 'user'), initcap(old_role), initcap(p_new_role)), 500),
            jsonb_build_object('user_email', target.email, 'old_role', old_role, 'new_role', p_new_role));
  end if;

  return jsonb_build_object('changed', true, 'old_role', old_role, 'new_role', p_new_role);
end;
$$;
revoke all on function public.change_user_role(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.change_user_role(uuid, text, uuid, text) to service_role;
