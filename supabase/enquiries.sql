-- =====================================================================
--  EDUVORA — FREE ENQUIRIES
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql. Safe to run again.
--
--  Who can do what (Row Level Security):
--   • Anyone (even not logged in) can SEND an enquiry
--   • Nobody except admins can READ, update or delete enquiries
-- =====================================================================

create table if not exists public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 80),
  phone       text not null check (phone ~ '^[0-9+ ()-]{10,16}$'),
  email       text check (email is null or (char_length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  class_year  text check (class_year is null or char_length(class_year) <= 40),
  message     text check (message is null or char_length(message) <= 1500),
  source      text not null default 'contact' check (source in ('contact', 'unlock', 'other')),
  status      text not null default 'new' check (status in ('new', 'contacted', 'converted')),
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists enquiries_created_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx  on public.enquiries (status);

-- New enquiries always start as "new", and are linked to the logged-in
-- user (if any) — a visitor cannot fake these fields.
create or replace function public.enquiries_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status     := 'new';
    new.user_id    := auth.uid();
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists enquiries_before_insert on public.enquiries;
create trigger enquiries_before_insert before insert on public.enquiries
  for each row execute function public.enquiries_before_insert();

-- ---------- Security (RLS) ----------
alter table public.enquiries enable row level security;

drop policy if exists "enquiries: anyone can send"  on public.enquiries;
drop policy if exists "enquiries: admin reads"      on public.enquiries;
drop policy if exists "enquiries: admin updates"    on public.enquiries;
drop policy if exists "enquiries: admin deletes"    on public.enquiries;

create policy "enquiries: anyone can send" on public.enquiries
  for insert to anon, authenticated with check (status = 'new');
create policy "enquiries: admin reads" on public.enquiries
  for select to authenticated using (public.is_admin());
create policy "enquiries: admin updates" on public.enquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "enquiries: admin deletes" on public.enquiries
  for delete to authenticated using (public.is_admin());

grant insert on public.enquiries to anon, authenticated;
grant select, update, delete on public.enquiries to authenticated;
