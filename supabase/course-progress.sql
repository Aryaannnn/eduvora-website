-- =====================================================================
--  COURSE PROGRESS ("Mark as done" + "Continue where you left off")
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs product-files.sql and courses-question-bank.sql — can_access_product.)
--
--  One row per student per PDF:
--   • done / done_at     — the student ticks "Mark as done" (their own login)
--   • last_opened_at     — set by the website's server when they open / download it
--  Row Level Security: a student sees and changes ONLY their own rows, and
--  only for PDFs they have access to. Admins / counsellors can read (Admin →
--  Students). Nothing else can change it.
-- =====================================================================

create table if not exists public.file_progress (
  user_id        uuid not null references auth.users (id) on delete cascade,
  file_id        uuid not null references public.product_files (id) on delete cascade,
  done           boolean not null default false,
  done_at        timestamptz,
  last_opened_at timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, file_id)
);
create index if not exists file_progress_opened_idx on public.file_progress (user_id, last_opened_at desc);

-- done_at = when it was ticked (cleared when unticked)
create or replace function public.file_progress_before_write()
returns trigger language plpgsql as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then new.done_at := now(); end if;
  if not new.done then new.done_at := null; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists file_progress_before_write on public.file_progress;
create trigger file_progress_before_write before insert or update on public.file_progress
  for each row execute function public.file_progress_before_write();

alter table public.file_progress enable row level security;
drop policy if exists "progress: own or staff read" on public.file_progress;
create policy "progress: own or staff read" on public.file_progress
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "progress: own add" on public.file_progress;
create policy "progress: own add" on public.file_progress
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.can_access_product(auth.uid(), (select f.product_id from public.product_files f where f.id = file_id))
  );
drop policy if exists "progress: own change" on public.file_progress;
create policy "progress: own change" on public.file_progress
  for update to authenticated using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.can_access_product(auth.uid(), (select f.product_id from public.product_files f where f.id = file_id))
  );
drop policy if exists "progress: own delete" on public.file_progress;
create policy "progress: own delete" on public.file_progress
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.file_progress from anon;
