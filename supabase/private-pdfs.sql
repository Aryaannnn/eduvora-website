-- =====================================================================
--  COURSE PDFs: SERVER-ONLY STORAGE
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  The website now streams every PDF itself (/api/files/<id>/open and
--  /download) after checking the login and the purchase on every request.
--  No storage link is sent to browsers any more. This file makes sure the
--  buckets can't be read any other way:
--   • 'materials' (originals), 'watermarked' (students' copies) and
--     'reader-pages' are PRIVATE (no public links)
--   • no storage rule lets students or visitors read them — only the
--     server (service role key) can. Admins keep read access to originals
--     for the admin panel ("materials: admins read" + admin upload/update/delete).
--  Nothing is deleted.
-- =====================================================================

update storage.buckets set public = false where id in ('materials', 'watermarked', 'reader-pages');

-- Remove every storage rule that would let a non-admin read these buckets
do $$
declare
  r record;
begin
  for r in
    select policyname, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') as rule
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
  loop
    if (r.rule ilike '%''watermarked''%' or r.rule ilike '%''reader-pages''%')
       or (r.rule ilike '%''materials''%' and r.cmd in ('SELECT', 'ALL') and r.rule not ilike '%is_admin()%') then
      execute format('drop policy if exists %I on storage.objects', r.policyname);
      raise notice 'removed storage rule: %', r.policyname;
    end if;
  end loop;
end;
$$;

-- What is left (should be: materials admin rules + blog images)
select policyname as "storage rule", cmd as "for", qual as "who"
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;
