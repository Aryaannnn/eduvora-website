-- =====================================================================
--  CRASH COURSES (PCM) + QUESTION BANK + WATERMARK FIX
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Needs setup.sql, packages.sql, product-files.sql, pdf-downloads.sql.)
--
--  1. New product type 'question_bank' (Physics / Chemistry / Mathematics,
--     each its own product + an optional "PCM bundle" that opens all three).
--  2. Every PDF can have a subject (physics / chemistry / mathematics) and a
--     chapter / day label — crash courses and the Question Bank show them by
--     subject.
--  3. Crash courses get "Include Question Bank access" (default off).
--  4. can_access_product(): ONE rule used by the website and by the database:
--       • admins: everything
--       • anyone who PAID for the product — even if you later hide it
--         (so hiding or replacing an old course never takes access away)
--       • free products (₹0 / Free) while they are active
--       • Question Bank products: also the PCM bundle, or any paid crash
--         course with "Include Question Bank access" switched on
--  5. The four "VITEEE … Day Crash Course" products and the Question Bank
--     products are created HIDDEN with placeholder prices — set the real
--     price, description and start date in Admin → Products, then switch
--     them on. Nothing existing is deleted or changed.
--  6. Watermark fix: all cached student copies are cleared so every copy is
--     made again with the new, stronger watermark.
-- =====================================================================

-- ---------- 1. product type + fields ----------
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('crash_course', 'study_material', 'previous_paper', 'mock_test', 'counselling_package', 'question_bank'));

alter table public.products add column if not exists subject text;
alter table public.products drop constraint if exists products_subject_check;
alter table public.products add constraint products_subject_check
  check (subject is null or subject in ('physics', 'chemistry', 'mathematics', 'pcm'));
alter table public.products add column if not exists includes_question_bank boolean not null default false;

-- ---------- 2. subject + chapter on each PDF ----------
alter table public.product_files add column if not exists subject text;
alter table public.product_files drop constraint if exists product_files_subject_check;
alter table public.product_files add constraint product_files_subject_check
  check (subject is null or subject in ('physics', 'chemistry', 'mathematics'));
alter table public.product_files add column if not exists chapter text;
alter table public.product_files drop constraint if exists product_files_chapter_check;
alter table public.product_files add constraint product_files_chapter_check check (chapter is null or char_length(chapter) <= 60);

-- ---------- 4. who may open a product's files ----------
create or replace function public.can_access_product(p_user uuid, p_product uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  p  public.products;
begin
  if p_user is null or p_product is null then return false; end if;
  -- a logged-in person may only ask about themselves (the server may ask about anyone)
  if auth.uid() is not null and auth.uid() <> p_user and not public.is_admin() then return false; end if;
  if exists (select 1 from public.profiles where id = p_user and role = 'admin') then return true; end if;

  select * into p from public.products where id = p_product;
  if not found then return false; end if;

  -- paid for it (also after it was hidden)
  if exists (select 1 from public.purchases where user_id = p_user and product_id = p_product and status = 'paid') then return true; end if;
  -- free while active
  if p.is_active and (p.is_free or p.price = 0) then return true; end if;

  -- Question Bank: the PCM bundle, or a crash course that includes it
  if p.category = 'question_bank' then
    if exists (select 1 from public.purchases pu join public.products b on b.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and b.category = 'question_bank' and b.subject = 'pcm') then
      return true;
    end if;
    if exists (select 1 from public.purchases pu join public.products c on c.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and c.category = 'crash_course' and c.includes_question_bank) then
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.can_access_product(uuid, uuid) from public, anon;
grant execute on function public.can_access_product(uuid, uuid) to authenticated, service_role;

-- Students see a file's details only when they may open it (admins: all)
drop policy if exists "product_files: buyers and admins read" on public.product_files;
create policy "product_files: buyers and admins read" on public.product_files
  for select to authenticated using (public.is_admin() or public.can_access_product(auth.uid(), product_id));

-- ---------- 5. the new products (hidden, placeholder prices) ----------
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, details)
select v.title, v.slug, v.descr, 'crash_course', v.price, null, false, false, v.sort_order,
       jsonb_build_object('duration', v.duration, 'mode', 'Online', 'short', v.descr)
  from (values
    ('VITEEE 60-Day Crash Course', 'viteee-60-day-crash-course', 'Complete Physics, Chemistry and Mathematics revision for VITEEE in 60 days, with day-wise PDFs.', 2499, 1, '60 days'),
    ('VITEEE 45-Day Crash Course', 'viteee-45-day-crash-course', 'Focused Physics, Chemistry and Mathematics revision for VITEEE in 45 days, with day-wise PDFs.', 1999, 2, '45 days'),
    ('VITEEE 30-Day Crash Course', 'viteee-30-day-crash-course', 'Fast-track Physics, Chemistry and Mathematics revision for VITEEE in 30 days, with day-wise PDFs.', 1499, 3, '30 days'),
    ('VITEEE 10-Day Crash Course', 'viteee-10-day-crash-course', 'Last-minute Physics, Chemistry and Mathematics revision for VITEEE in 10 days.', 799, 4, '10 days')
  ) as v (title, slug, descr, price, sort_order, duration)
 where not exists (select 1 from public.products x where x.slug = v.slug);

insert into public.products (title, slug, description, category, subject, price, original_price, is_free, is_active, sort_order, details)
select v.title, v.slug, v.descr, 'question_bank', v.subject, v.price, null, false, false, v.sort_order, jsonb_build_object('format', 'PDF (watermarked)')
  from (values
    ('Physics Question Bank', 'question-bank-physics', 'Chapter-wise VITEEE Physics questions with answers.', 'physics', 299, 1),
    ('Chemistry Question Bank', 'question-bank-chemistry', 'Chapter-wise VITEEE Chemistry questions with answers.', 'chemistry', 299, 2),
    ('Mathematics Question Bank', 'question-bank-mathematics', 'Chapter-wise VITEEE Mathematics questions with answers.', 'mathematics', 299, 3),
    ('PCM Question Bank (bundle)', 'question-bank-pcm', 'Physics, Chemistry and Mathematics question banks together at one price.', 'pcm', 699, 4)
  ) as v (title, slug, descr, subject, price, sort_order)
 where not exists (select 1 from public.products x where x.slug = v.slug);

-- ---------- 6. watermark fix: make every cached copy again ----------
do $$
begin
  if to_regclass('public.pdf_copies') is not null then
    alter table public.pdf_copies add column if not exists wm_version integer not null default 1;
    delete from public.pdf_copies where wm_version < 2;   -- old copies → made again (overwritten) on the next open
  end if;
end;
$$;
