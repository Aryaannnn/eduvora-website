-- =====================================================================
--  EDUVORA — WATERMARKED PDF DOWNLOADS + DOWNLOAD LOG
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE file
--  → Run. Run it AFTER product-files.sql. Safe to run again.
--
--  • Every student download is logged (Admin → Products → Downloads).
--    The log id is printed in the PDF footer, so a leaked copy can be traced.
--  • 'watermarked' is a PRIVATE bucket for the temporary watermarked copies
--    (only the server can read/write it; they are deleted automatically).
--    The original files in 'materials' are never changed.
-- =====================================================================

create table if not exists public.file_downloads (
  id           uuid primary key default gen_random_uuid(),  -- = "Download ID" in the PDF footer
  user_id      uuid references auth.users (id) on delete set null,
  file_id      uuid references public.product_files (id) on delete set null,
  product_id   uuid references public.products (id) on delete set null,
  file_name    text not null,
  file_type    text not null check (file_type in ('pdf', 'zip')),
  action       text not null default 'download' check (action in ('download', 'view')),
  watermarked  boolean not null default false,
  status       text not null default 'ok' check (status in ('ok', 'failed')),
  error        text,
  device       text,          -- short, anonymous device id (hash) — to spot one account on many devices
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists file_downloads_time_idx on public.file_downloads (created_at desc);
create index if not exists file_downloads_user_idx on public.file_downloads (user_id, created_at desc);

alter table public.file_downloads enable row level security;
drop policy if exists "downloads: admin reads" on public.file_downloads;
create policy "downloads: admin reads" on public.file_downloads for select to authenticated using (public.is_admin());
-- (Only the server writes the log.)

-- Private bucket for temporary watermarked copies (no public policies = server only)
insert into storage.buckets (id, name, public)
values ('watermarked', 'watermarked', false)
on conflict (id) do update set public = false;
