-- =====================================================================
--  WATERMARKED PDF DOWNLOADS — open in a new tab or download
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs product-files.sql and watermark-downloads.sql.)
--
--  • pdf_settings: how many opens/downloads per student, per file, per day
--    (default 20) — Admin → Settings.
--  • pdf_copies: each student's watermarked copy of a file is kept for 7 days
--    in the private 'watermarked' bucket (folder copies/), so opening it again
--    is instant. Replacing the file makes old copies invalid (path changes).
--  • file_downloads.copy_id: the ID printed on the copy (footer) — every open
--    and download is logged with it, so a shared copy can be traced
--    (Admin → Products → Downloads → search the ID).
--  • Product cards: the "Read online" format label → "PDF (watermarked)".
-- =====================================================================

-- ---------- 1. daily limit (one row) ----------
create table if not exists public.pdf_settings (
  id           integer primary key default 1 check (id = 1),
  daily_limit  integer not null default 20 check (daily_limit between 1 and 500),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);
insert into public.pdf_settings (id) values (1) on conflict (id) do nothing;
alter table public.pdf_settings enable row level security;
drop policy if exists "pdf settings: admin reads" on public.pdf_settings;
drop policy if exists "pdf settings: admin updates" on public.pdf_settings;
create policy "pdf settings: admin reads" on public.pdf_settings for select to authenticated using (public.is_admin());
create policy "pdf settings: admin updates" on public.pdf_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.pdf_settings from anon, authenticated;

create or replace function public.before_pdf_settings_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id := 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
drop trigger if exists before_pdf_settings_update on public.pdf_settings;
create trigger before_pdf_settings_update before update on public.pdf_settings
  for each row execute function public.before_pdf_settings_update();

-- ---------- 2. cached watermarked copies (server only) ----------
create table if not exists public.pdf_copies (
  user_id       uuid not null references auth.users (id) on delete cascade,
  file_id       uuid not null references public.product_files (id) on delete cascade,
  file_path     text not null,       -- the original's path when the copy was made (replaced file → no match)
  copy_id       uuid not null,       -- printed in the footer of every page
  storage_path  text not null,       -- inside the private 'watermarked' bucket
  created_at    timestamptz not null default now(),
  primary key (user_id, file_id)
);
create index if not exists pdf_copies_age_idx on public.pdf_copies (created_at);
alter table public.pdf_copies enable row level security;   -- no policies: only the server uses it

-- ---------- 3. log: the copy's printed ID ----------
alter table public.file_downloads add column if not exists copy_id uuid;
create index if not exists file_downloads_copy_idx on public.file_downloads (copy_id);
create index if not exists file_downloads_user_file_day_idx on public.file_downloads (user_id, file_id, created_at desc);

-- make sure the private bucket exists
insert into storage.buckets (id, name, public) values ('watermarked', 'watermarked', false)
on conflict (id) do update set public = false;

-- ---------- 4. product card label ----------
do $$
begin
  update public.products
     set details = jsonb_set(details, '{format}', '"PDF (watermarked)"')
   where details ? 'format' and details ->> 'format' in ('Read online', 'PDF + Printed', 'PDF + printed', 'PDF', 'PDF download', 'Instant download');
end;
$$;
