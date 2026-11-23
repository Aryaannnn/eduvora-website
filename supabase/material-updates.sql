-- =====================================================================
--  "NEW MATERIAL" FOR STUDENTS (badges, bell, daily email)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs product-files.sql and courses-question-bank.sql — can_access_product.)
--
--  • product_files.added_at — when a PDF was uploaded to / moved into its
--    product. A PDF is "New" for a student for 7 days or until they open it.
--  • material_updates — one notification per course + subject; uploads within
--    10 minutes are grouped ("3 new PDFs added to … · Physics").
--  • material_update_reads — which updates each student has read (bell count).
--  • Students only see updates of courses they can open; only their own reads.
-- =====================================================================

-- ---------- when a PDF arrived in its product ----------
alter table public.product_files add column if not exists added_at timestamptz;
update public.product_files set added_at = created_at where added_at is null;
alter table public.product_files alter column added_at set default now();

create table if not exists public.material_updates (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  subject     text,
  file_count  integer not null default 1,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  emailed_at  timestamptz            -- the daily email went out (or emails were off)
);
create index if not exists material_updates_product_idx on public.material_updates (product_id, last_at desc);
create index if not exists material_updates_time_idx on public.material_updates (last_at desc);

create table if not exists public.material_update_reads (
  user_id    uuid not null references auth.users (id) on delete cascade,
  update_id  uuid not null references public.material_updates (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (user_id, update_id)
);

-- at most one "new material" email per course per day
create table if not exists public.material_emails (
  product_id uuid not null references public.products (id) on delete cascade,
  day        date not null,
  sent       integer not null default 0,
  primary key (product_id, day)
);

-- ---------- upload / move → "added now" + one grouped notification ----------
create or replace function public.product_files_mark_added()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.product_id is distinct from old.product_id then
    new.added_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists product_files_mark_added on public.product_files;
create trigger product_files_mark_added before insert or update of product_id on public.product_files
  for each row execute function public.product_files_mark_added();

create or replace function public.product_files_notify()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if new.file_type <> 'pdf' then return null; end if;
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id then return null; end if;
  if not exists (select 1 from public.products p where p.id = new.product_id and p.category in ('crash_course', 'question_bank')) then return null; end if;
  -- the same course + subject within 10 minutes → the same notification
  update public.material_updates
     set file_count = file_count + 1, last_at = now()
   where id = (select u.id from public.material_updates u
                where u.product_id = new.product_id and u.subject is not distinct from new.subject
                  and u.last_at > now() - interval '10 minutes'
                order by u.last_at desc limit 1)
  returning id into v_id;
  if v_id is null then
    insert into public.material_updates (product_id, subject) values (new.product_id, new.subject);
  else
    delete from public.material_update_reads where update_id = v_id; -- more files → unread again
  end if;
  return null;
end;
$$;
drop trigger if exists product_files_notify on public.product_files;
create trigger product_files_notify after insert or update of product_id on public.product_files
  for each row execute function public.product_files_notify();

-- ---------- who may see what ----------
alter table public.material_updates enable row level security;
drop policy if exists "material updates: students of the course" on public.material_updates;
create policy "material updates: students of the course" on public.material_updates
  for select to authenticated using (public.is_staff() or public.can_access_product(auth.uid(), product_id));
revoke insert, update, delete on public.material_updates from anon, authenticated;

alter table public.material_update_reads enable row level security;
drop policy if exists "material reads: own" on public.material_update_reads;
create policy "material reads: own" on public.material_update_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.material_update_reads from anon;

alter table public.material_emails enable row level security;
revoke all on public.material_emails from anon, authenticated;

-- old updates go after 60 days (with the daily clean-up)
create or replace function public.purge_old_material_updates()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.material_updates where last_at < now() - interval '60 days' returning 1) select count(*)::int from d;
$$;
revoke all on function public.purge_old_material_updates() from public, anon, authenticated;
grant execute on function public.purge_old_material_updates() to service_role;
