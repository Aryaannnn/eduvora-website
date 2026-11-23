-- =====================================================================
--  STORAGE + DATABASE: REPORT, CLEAN-UP LIST, DUPLICATES, LOG RETENTION
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql, product-files.sql, pdf-downloads.sql, admin-security.sql.)
--
--  1. storage_report()      → Admin → Settings: space per kind + database size
--  2. storage_cleanup_list()→ files that can be removed (shown to the admin,
--                             deleted ONLY after the admin confirms)
--  3. product_files.content_hash → identical PDFs are stored once
--  4. purge_old_logs()      → run every day by the cron job:
--       email log, download / view logs, old login-session records: > 90 days
--       admin activity log: > 1 year
--     Payments, purchases, bookings, invoices are NEVER touched.
--  Nothing is deleted by running this file.
-- =====================================================================

-- ---------- 1. the report ----------
create or replace function public.storage_report()
returns table (kind text, files bigint, bytes bigint)
language plpgsql stable security definer set search_path = public, storage
as $$
begin
  if auth.uid() is not null and not public.is_admin() then return; end if;
  return query
    select k.kind, count(*)::bigint, coalesce(sum(k.size), 0)::bigint
      from (
        select case
                 when o.bucket_id = 'materials' then 'originals'
                 when o.bucket_id = 'watermarked' then 'watermarked'
                 when o.bucket_id = 'reader-pages' then 'reader_pages'
                 when o.bucket_id = 'blog-images' or coalesce(o.metadata ->> 'mimetype', '') like 'image/%' then 'images'
                 else 'other'
               end as kind,
               coalesce((o.metadata ->> 'size')::bigint, 0) as size
          from storage.objects o
      ) k
     group by k.kind
    union all
    select 'database', null::bigint, pg_database_size(current_database())::bigint;
end;
$$;
revoke all on function public.storage_report() from public, anon;
grant execute on function public.storage_report() to authenticated, service_role;

-- ---------- 3. duplicates: one hash per PDF ----------
alter table public.product_files add column if not exists content_hash text;
-- identical PDFs in several products share ONE stored file → a path may be used more than once
alter table public.product_files drop constraint if exists product_files_file_path_key;
create index if not exists product_files_hash_idx on public.product_files (content_hash) where content_hash is not null;
create index if not exists product_files_path_idx on public.product_files (file_path);

-- ---------- 2. what could be removed (nothing is deleted here) ----------
-- reason:
--   'zip_unused'        a ZIP in materials no product uses
--   'orphan_original'   a file in materials no product / product file uses (left after replace / delete)
--   'duplicate'         the same PDF (same hash) stored again — products are pointed to one copy first
--   'orphan_copy'       a watermarked copy the website no longer knows about
--   'old_copy'          a watermarked copy older than 24 hours
--   'reader_page'       a page picture from the in-website reader (switched off)
drop function if exists public.storage_cleanup_list();
create or replace function public.storage_cleanup_list()
returns table (bucket text, path text, bytes bigint, reason text, detail text, keep_path text)
language plpgsql stable security definer set search_path = public, storage
as $$
begin
  if auth.uid() is not null and not public.is_admin() then return; end if;
  return query
  with used as (
    select file_path as p from public.product_files where file_path is not null
    union
    select file_path from public.products where file_path is not null
  ),
  copies as (select storage_path as p from public.pdf_copies where storage_path is not null),
  paths as (   -- each stored PDF (hash + path) once
    select f.content_hash as h, f.file_path as p, min(f.display_name) as display_name, min(f.created_at) as first_at
      from public.product_files f
     where f.content_hash ~ '^[0-9a-f]{64}$'   -- real fingerprints only ('missing' = file couldn't be read)
     group by f.content_hash, f.file_path
  ),
  dup as (     -- the same PDF stored at more than one path: keep the oldest
    select x.*, row_number() over (partition by x.h order by x.first_at, x.p) as n,
           first_value(x.p) over (partition by x.h order by x.first_at, x.p) as keep
      from paths x
  )
  select o.bucket_id::text, o.name::text, coalesce((o.metadata ->> 'size')::bigint, 0),
         case when lower(o.name) like '%.zip' then 'zip_unused' else 'orphan_original' end,
         'not used by any product'::text, null::text
    from storage.objects o
   where o.bucket_id = 'materials' and o.name not like '%/.emptyFolderPlaceholder'
     and not exists (select 1 from used u where u.p = o.name)
  union all
  select 'materials', d.p, coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'materials' and o.name = d.p), 0),
         'duplicate', 'same PDF as another file — ' || d.display_name, d.keep
    from dup d where d.n > 1
  union all
  select o.bucket_id::text, o.name::text, coalesce((o.metadata ->> 'size')::bigint, 0),
         case when exists (select 1 from copies c where c.p = o.name) then 'old_copy' else 'orphan_copy' end,
         'watermarked copy from ' || to_char(coalesce(o.updated_at, o.created_at) at time zone 'Asia/Kolkata', 'DD Mon YYYY'), null::text
    from storage.objects o
   where o.bucket_id = 'watermarked'
     and (coalesce(o.updated_at, o.created_at) < now() - interval '24 hours' or not exists (select 1 from copies c where c.p = o.name))
  union all
  select o.bucket_id::text, o.name::text, coalesce((o.metadata ->> 'size')::bigint, 0), 'reader_page', 'in-website reader page picture', null::text
    from storage.objects o where o.bucket_id = 'reader-pages';
end;
$$;
revoke all on function public.storage_cleanup_list() from public, anon;
grant execute on function public.storage_cleanup_list() to authenticated, service_role;

-- ---------- 4. log retention ----------
-- The activity log is read-only (admin-security.sql). Only THIS function may
-- remove entries older than 1 year; nothing else can change or delete them.
create or replace function public.admin_activity_is_read_only()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('eduvora.purge_activity', true) = 'on' and old.created_at < now() - interval '1 year' then
    return old;
  end if;
  raise exception 'The activity log cannot be changed or deleted.';
end;
$$;

create or replace function public.purge_old_logs()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  n_email int := 0; n_dl int := 0; n_view int := 0; n_sess int := 0; n_act int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'not allowed'; end if;
  if to_regclass('public.email_logs') is not null then
    delete from public.email_logs where created_at < now() - interval '90 days';
    get diagnostics n_email = row_count;
  end if;
  if to_regclass('public.file_downloads') is not null then
    delete from public.file_downloads where created_at < now() - interval '90 days';
    get diagnostics n_dl = row_count;
  end if;
  if to_regclass('public.file_views') is not null then
    delete from public.file_views where created_at < now() - interval '90 days';
    get diagnostics n_view = row_count;
  end if;
  if to_regclass('public.login_sessions') is not null then
    delete from public.login_sessions where last_seen < now() - interval '90 days';
    get diagnostics n_sess = row_count;
  end if;
  if to_regclass('public.admin_activity') is not null then
    perform set_config('eduvora.purge_activity', 'on', true);
    delete from public.admin_activity where created_at < now() - interval '1 year';
    get diagnostics n_act = row_count;
    perform set_config('eduvora.purge_activity', 'off', true);
  end if;
  return jsonb_build_object('email_logs', n_email, 'file_downloads', n_dl, 'file_views', n_view, 'login_sessions', n_sess, 'admin_activity', n_act);
end;
$$;
revoke all on function public.purge_old_logs() from public, anon, authenticated;
grant execute on function public.purge_old_logs() to service_role;

-- What you have now
select kind, files, pg_size_pretty(bytes) as size from public.storage_report() order by bytes desc;
