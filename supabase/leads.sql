-- =====================================================================
--  LEADS (CRM) — Admin → Leads
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Run it AFTER the other files (it reads profiles, enquiries, predictions,
--  purchases, bookings and test attempts).
--
--  • leads       — one row per person (merged by account, email or phone)
--                  with pipeline status, follow-up date and sources.
--  • lead_notes  — your notes about a lead.
--  • sync_leads() — collects every potential student from:
--        signup · enquiry · predictor · free_resource · abandoned_payment · booking
--    and merges duplicates. Run automatically when you open Admin → Leads
--    and by the 15-minute cron. Students who pay → status 'paid'.
--  • leads_overview — leads + total paid (for the admin page).
--  Only admins (with 2-step login) and the server can see any of this
--  (and counsellors, after supabase/counsellor.sql — without amounts).
-- =====================================================================

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
