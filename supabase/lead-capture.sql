-- =====================================================================
--  LEAD CAPTURE — free guide popup + abandoned checkout reminders
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs leads.sql / roles.sql, emails-invoices.sql and product-files.sql.)
--
--  1. growth_settings: which free product is "the guide", popup on/off,
--     abandoned-checkout reminders on/off (Admin → Settings).
--  2. guide_requests: everyone who asked for the free guide (name, email /
--     phone, class, consent time). Server only — never readable from the browser.
--  3. capture_guide_lead(): adds / updates the person in Admin → Leads with
--     the source "free_guide" (shown as "Free guide").
--  4. Reminder columns on purchases + bookings so each reminder is sent once.
-- =====================================================================

-- ---------- 1. settings (one row) ----------
create table if not exists public.growth_settings (
  id                    integer primary key default 1 check (id = 1),
  guide_enabled         boolean not null default true,
  guide_product_id      uuid references public.products (id) on delete set null,
  abandoned_reminders   boolean not null default false,   -- OFF until you switch it on
  abandoned_enabled_at  timestamptz,                      -- only payments started after this get reminders
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null
);
insert into public.growth_settings (id) values (1) on conflict (id) do nothing;

alter table public.growth_settings enable row level security;
drop policy if exists "growth: anyone reads"  on public.growth_settings;
drop policy if exists "growth: admin updates" on public.growth_settings;
create policy "growth: anyone reads" on public.growth_settings
  for select to anon, authenticated using (true);
create policy "growth: admin updates" on public.growth_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.growth_settings from anon, authenticated;
revoke update on public.growth_settings from anon;

create or replace function public.before_growth_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  -- switched ON → remember when (older unfinished payments never get a reminder)
  if new.abandoned_reminders and not coalesce(old.abandoned_reminders, false) then
    new.abandoned_enabled_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists before_growth_update on public.growth_settings;
create trigger before_growth_update before update on public.growth_settings
  for each row execute function public.before_growth_update();

-- ---------- 2. guide requests (server only) ----------
create table if not exists public.guide_requests (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references public.products (id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 2 and 80),
  email        text check (email is null or char_length(email) <= 120),
  phone        text check (phone is null or phone ~ '^[0-9]{10}$'),
  class_year   text check (class_year is null or char_length(class_year) <= 40),
  consent_at   timestamptz not null,
  ip_hash      text,                 -- scrambled IP, only for spam limits (not reversible)
  emailed_at   timestamptz,
  downloads    integer not null default 0,
  created_at   timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index if not exists guide_requests_email_idx on public.guide_requests (lower(email), created_at desc);
create index if not exists guide_requests_ip_idx on public.guide_requests (ip_hash, created_at desc);
alter table public.guide_requests enable row level security;   -- no policies = server only
revoke all on public.guide_requests from anon, authenticated;

-- ---------- 3. add / update the lead ("Free guide") ----------
create or replace function public.capture_guide_lead(p_name text, p_email text, p_phone text, p_class text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  e   text := public.lead_email(btrim(p_email));
  ph  text := public.lead_phone(p_phone);
  lid uuid;
begin
  if e is null and ph is null then return null; end if;
  select id into lid from public.leads
   where (e is not null and email = e) or (ph is not null and phone = ph)
   order by first_seen_at limit 1;
  if lid is null then
    insert into public.leads (email, phone, name, class_year, sources, first_seen_at, last_activity_at)
    values (e, ph, nullif(btrim(p_name), ''), nullif(btrim(p_class), ''), array['free_guide'], now(), now())
    returning id into lid;
  else
    update public.leads set
      email            = coalesce(email, e),
      phone            = coalesce(phone, ph),
      name             = coalesce(name, nullif(btrim(p_name), '')),
      class_year       = coalesce(nullif(btrim(p_class), ''), class_year),
      sources          = case when 'free_guide' = any (sources) then sources else sources || 'free_guide'::text end,
      last_activity_at = now()
     where id = lid;
  end if;
  return lid;
exception when unique_violation then
  -- the email belongs to one lead and the phone to another → keep it simple: update by email
  update public.leads set sources = case when 'free_guide' = any (sources) then sources else sources || 'free_guide'::text end,
                          last_activity_at = now()
   where email = e or phone = ph;
  return null;
end;
$$;
revoke all on function public.capture_guide_lead(text, text, text, text) from public, anon, authenticated;
grant execute on function public.capture_guide_lead(text, text, text, text) to service_role;

-- ---------- 4. "You left something behind" — each reminder only once ----------
alter table public.purchases add column if not exists nudge_2h_at  timestamptz;
alter table public.purchases add column if not exists nudge_24h_at timestamptz;
alter table public.bookings  add column if not exists nudge_2h_at  timestamptz;
alter table public.bookings  add column if not exists nudge_24h_at timestamptz;
