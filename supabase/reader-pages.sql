-- =====================================================================
--  FAST READER — every PDF page stored once as a WebP picture
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs product-files.sql and secure-reader.sql.)
--
--  • When you upload a PDF (Admin → Products → Files), the server turns each
--    page ONCE into a compressed WebP picture (1400 px wide) and keeps them in
--    the PRIVATE bucket 'reader-pages' (folder = the file's id). The original
--    PDF stays private in 'materials'.
--  • Students' browsers get only the current and the next page, through
--    60-second signed links made by the server after checking access.
--  • reader_usage(): page views + estimated data served this month
--    (Admin → Products), to keep an eye on Vercel / Supabase limits.
-- =====================================================================

-- ---------- 1. page status on each file ----------
alter table public.product_files add column if not exists page_count      integer;
alter table public.product_files add column if not exists pages_status    text not null default 'none';
alter table public.product_files add column if not exists pages_done      integer not null default 0;
alter table public.product_files add column if not exists pages_bytes     bigint not null default 0;   -- total size of the WebP pages
alter table public.product_files add column if not exists pages_error     text;
alter table public.product_files add column if not exists pages_version   integer not null default 0;  -- +1 on every (re)process
alter table public.product_files add column if not exists pages_updated_at timestamptz;
alter table public.product_files drop constraint if exists product_files_pages_status_check;
alter table public.product_files add constraint product_files_pages_status_check
  check (pages_status in ('none', 'processing', 'ready', 'failed'));

-- ---------- 2. private bucket for the page pictures (server only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reader-pages', 'reader-pages', false, 5242880, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/webp'];
-- (No storage policies on purpose: only the website's server reads and writes it.)

-- ---------- 3. usage this month (Admin → Products) ----------
-- views  = pages opened this month (from the reading log)
-- bytes  = estimated data sent: each view × that file's average page size
-- stored = total size of all page pictures
create or replace function public.reader_usage(p_since timestamptz default date_trunc('month', now()))
returns table (views bigint, bytes bigint, stored bigint, files_ready bigint, files_waiting bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then return; end if;
  return query
    select
      (select count(*) from public.file_views v where v.created_at >= p_since),
      (select coalesce(sum(case when f.page_count > 0 then f.pages_bytes / f.page_count else 0 end), 0)::bigint
         from public.file_views v join public.product_files f on f.id = v.file_id
        where v.created_at >= p_since),
      (select coalesce(sum(pages_bytes), 0)::bigint from public.product_files),
      (select count(*) from public.product_files where file_type = 'pdf' and pages_status = 'ready'),
      (select count(*) from public.product_files where file_type = 'pdf' and pages_status <> 'ready');
end;
$$;
revoke all on function public.reader_usage(timestamptz) from public, anon;
grant execute on function public.reader_usage(timestamptz) to authenticated, service_role;
