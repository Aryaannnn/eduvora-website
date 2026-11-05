-- =====================================================================
--  EDUVORA — MULTIPLE PDF / ZIP FILES PER PRODUCT
--
--  HOW TO USE: Supabase → SQL Editor → New query → paste this WHOLE
--  file → click "Run". Run it AFTER setup.sql and payments.sql. Safe to run again.
--
--  • product_files: one row per file (Notes.pdf, Formula Sheet.pdf, Practice.zip …)
--  • Files live in the PRIVATE 'materials' bucket:  materials/<product id>/<file>
--  • Only admins add / edit / delete. Students see a product's files only if
--    they PAID for it (or it is free). Downloads use 60-second links made by
--    the website's server.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
create table if not exists public.product_files (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  display_name    text not null check (char_length(trim(display_name)) between 1 and 120),
  file_path       text not null unique,                   -- path inside the 'materials' bucket
  file_type       text not null check (file_type in ('pdf', 'zip')),
  size_bytes      bigint not null default 0 check (size_bytes >= 0),
  sort_order      integer not null default 0,
  download_count  integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists product_files_product_idx on public.product_files (product_id, sort_order);

-- ---------------------------------------------------------------------
-- 2. Security (RLS)
-- ---------------------------------------------------------------------
alter table public.product_files enable row level security;

drop policy if exists "product_files: buyers and admins read" on public.product_files;
drop policy if exists "product_files: admin insert"           on public.product_files;
drop policy if exists "product_files: admin update"           on public.product_files;
drop policy if exists "product_files: admin delete"           on public.product_files;

create policy "product_files: buyers and admins read" on public.product_files
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.products p
       where p.id = product_files.product_id
         and p.is_active
         and (p.is_free or public.has_purchased(p.id))
    )
  );
create policy "product_files: admin insert" on public.product_files
  for insert to authenticated with check (public.is_admin());
create policy "product_files: admin update" on public.product_files
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "product_files: admin delete" on public.product_files
  for delete to authenticated using (public.is_admin());

revoke all on public.product_files from anon;

-- Count a download (server only)
create or replace function public.count_file_download(p_file uuid)
returns void language sql security definer set search_path = public as $$
  update public.product_files set download_count = download_count + 1 where id = p_file;
$$;
revoke all on function public.count_file_download(uuid) from public, anon, authenticated;
grant execute on function public.count_file_download(uuid) to service_role;

-- Total size of everything in the 'materials' bucket (admin only)
create or replace function public.materials_storage_used()
returns bigint language plpgsql stable security definer set search_path = public, storage as $$
begin
  if auth.uid() is not null and not public.is_admin() then return null; end if;
  return coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects where bucket_id = 'materials'), 0);
end $$;
revoke all on function public.materials_storage_used() from public, anon;
grant execute on function public.materials_storage_used() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Bucket: private, PDF + ZIP only, 50 MB per file (Supabase Free plan max)
--    On a paid plan you can raise it: change 52428800 below (bytes) AND
--    Supabase → Storage → Settings → "Upload file size limit".
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

update storage.buckets
   set public = false,
       file_size_limit = 52428800,
       allowed_mime_types = array['application/pdf', 'application/zip', 'application/x-zip-compressed']
 where id = 'materials';

-- Students may read a stored file only if it belongs to a product they paid for (or a free one)
drop policy if exists "materials: buyers can download" on storage.objects;
create policy "materials: buyers can download" on storage.objects
  for select to authenticated using (
    bucket_id = 'materials' and (
      public.is_admin()
      or exists (
        select 1 from public.product_files f
          join public.products p on p.id = f.product_id
         where f.file_path = storage.objects.name
           and p.is_active
           and (p.is_free or public.has_purchased(p.id))
      )
      or exists (
        select 1 from public.products p
         where p.file_path = storage.objects.name
           and p.is_active
           and (p.is_free or public.has_purchased(p.id))
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Move old single uploads (products.file_path) into product_files
-- ---------------------------------------------------------------------
insert into public.product_files (product_id, display_name, file_path, file_type, size_bytes, sort_order, created_at)
select p.id,
       p.title,
       p.file_path,
       case when lower(p.file_path) like '%.zip' then 'zip' else 'pdf' end,
       coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o
                  where o.bucket_id = 'materials' and o.name = p.file_path limit 1), 0),
       0,
       p.created_at
  from public.products p
 where p.file_path is not null and p.file_path <> ''
on conflict (file_path) do nothing;
