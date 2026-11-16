-- =====================================================================
--  SECURE READER — read-only course material, reading log, 2 devices
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql, product-files.sql and watermark-downloads.sql.)
--
--  1. Students can NO LONGER fetch files from the private 'materials'
--     storage bucket themselves (the old "buyers can download" rule is
--     removed). Only the website's server reads the files, one page at a
--     time, after checking access (src/app/api/reader/...). Admins keep
--     access for uploading and checking files.
--  2. file_views: every page a student reads (student, file, page, device,
--     time) — Admin → Products → Reading log, with unusual activity flagged.
--  3. enforce_device_limit(): at most 2 logged-in devices per student; the
--     OLDEST login is signed out. Admins and counsellors are not limited.
--     (Uses its own login_sessions list — Supabase's auth tables are not changed.)
--  4. Product cards: the old "PDF + Printed" / "PDF" format labels → "Read online".
-- =====================================================================

-- ---------- 1. originals: server + admins only ----------
drop policy if exists "materials: buyers can download" on storage.objects;
drop policy if exists "materials: admins read" on storage.objects;
create policy "materials: admins read" on storage.objects
  for select to authenticated using (bucket_id = 'materials' and public.is_admin());

-- ---------- 2. reading log ----------
create table if not exists public.file_views (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  file_id     uuid references public.product_files (id) on delete set null,
  product_id  uuid references public.products (id) on delete set null,
  page        integer not null check (page >= 1),
  device      text,          -- random id kept in a cookie on that browser (anonymous)
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists file_views_time_idx on public.file_views (created_at desc);
create index if not exists file_views_user_file_idx on public.file_views (user_id, file_id, created_at desc);

alter table public.file_views enable row level security;
drop policy if exists "file views: admin reads" on public.file_views;
create policy "file views: admin reads" on public.file_views for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.file_views from anon, authenticated;   -- only the server writes it

-- ---------- 3. two devices per student ----------
-- Our own list of logins (Supabase's internal session table is never touched).
-- The website (src/proxy.ts) calls enforce_device_limit() every couple of minutes
-- for a logged-in student. It keeps the 2 NEWEST logins of the account; older
-- ones are marked signed out, and on their next visit the website signs them
-- out properly (which also cancels that login at Supabase).
create table if not exists public.login_sessions (
  session_id  uuid primary key,                      -- the login's id (from the login token)
  user_id     uuid not null references auth.users (id) on delete cascade,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  user_agent  text,
  revoked_at  timestamptz                            -- set when a newer login pushed it out
);
create index if not exists login_sessions_user_idx on public.login_sessions (user_id, first_seen desc);
alter table public.login_sessions enable row level security;
drop policy if exists "login sessions: admin reads" on public.login_sessions;
create policy "login sessions: admin reads" on public.login_sessions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.login_sessions from anon, authenticated;

-- Returns false when THIS login has been pushed out (→ the website signs it out).
create or replace function public.enforce_device_limit(p_keep integer default 2, p_user_agent text default null)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  me   uuid := auth.uid();
  sid  uuid;
  r    text;
begin
  if me is null then return true; end if;
  select role into r from public.profiles where id = me;
  if r in ('admin', 'counsellor') then return true; end if;
  begin
    sid := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', '')::uuid;
  exception when others then sid := null;
  end;
  if sid is null then return true; end if;

  insert into public.login_sessions (session_id, user_id, user_agent)
  values (sid, me, left(p_user_agent, 200))
  on conflict (session_id) do update set last_seen = now();

  -- keep the newest p_keep logins, push out the rest
  update public.login_sessions
     set revoked_at = now()
   where user_id = me and revoked_at is null
     and session_id in (select l.session_id from public.login_sessions l
                         where l.user_id = me and l.revoked_at is null
                         order by l.first_seen desc offset greatest(coalesce(p_keep, 2), 1));

  delete from public.login_sessions where user_id = me and revoked_at < now() - interval '30 days';
  return not exists (select 1 from public.login_sessions where session_id = sid and revoked_at is not null);
end;
$$;
drop function if exists public.enforce_device_limit(integer);
revoke all on function public.enforce_device_limit(integer, text) from public, anon;
grant execute on function public.enforce_device_limit(integer, text) to authenticated, service_role;

-- ---------- 4. product wording: read online, no downloads ----------
-- The small "format" label on study material / paper cards (only the old default labels)
do $$
begin
  update public.products
     set details = jsonb_set(details, '{format}', '"Read online"')
   where details ? 'format' and details ->> 'format' in ('PDF + Printed', 'PDF + printed', 'PDF', 'PDF download', 'Instant download');
end;
$$;
