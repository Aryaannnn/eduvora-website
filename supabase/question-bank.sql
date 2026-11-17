-- =====================================================================
--  VITEEE QUESTION BANK — ONE product, the sixth card in Courses (after the
--  Formula Book). Works exactly like the Formula Book / crash courses.
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Run AFTER courses-question-bank.sql (and four-courses.sql / formula-book.sql).
--
--  1. Creates "VITEEE Question Bank" (web name viteee-question-bank): neutral
--     placeholder text and price, HIDDEN until you set it up in Admin →
--     Products and switch "Visible on website" on. Your own edits are kept.
--  2. MERGES the earlier Question Bank (the separate Physics / Chemistry /
--     Mathematics products and the PCM bundle):
--       • their PDFs are MOVED into the matching subject of the new product
--         (chapter and order kept; nothing is deleted);
--       • the old products are hidden (not deleted);
--       • everyone who bought or unlocked ANY of them keeps access — they now
--         get the new Question Bank (all three subjects) in My Courses;
--       • crash courses with "Include Question Bank access" now open the new
--         Question Bank.
--  3. The last query shows what was moved / hidden and who keeps access.
-- =====================================================================

-- ---------- 1. the product ----------
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, details)
select 'VITEEE Question Bank', 'viteee-question-bank',
       'Chapter-wise practice questions for Physics, Chemistry and Mathematics.',
       'crash_course', 499, null, false, false, 6,
       jsonb_build_object(
         'short', 'Chapter-wise practice questions for Physics, Chemistry and Mathematics.',
         'who_for', jsonb_build_array('Students preparing for VITEEE who want chapter-wise practice'))
 where not exists (select 1 from public.products where slug = 'viteee-question-bank');

update public.products set category = 'crash_course', sort_order = 6 where slug = 'viteee-question-bank';

-- ---------- access: earlier Question Bank buyers + crash courses that include it ----------
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

  -- the VITEEE Question Bank: anyone who bought / unlocked an earlier Question Bank
  -- product (any subject or the PCM bundle), or a crash course that includes it
  if p.slug = 'viteee-question-bank' then
    if exists (select 1 from public.purchases pu join public.products b on b.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and b.category = 'question_bank') then
      return true;
    end if;
    if exists (select 1 from public.purchases pu join public.products c on c.id = pu.product_id
                where pu.user_id = p_user and pu.status = 'paid' and c.category = 'crash_course' and c.includes_question_bank) then
      return true;
    end if;
  end if;

  -- (earlier per-subject Question Bank products — kept working)
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

-- ---------- 2. merge: move the earlier Question Bank PDFs ----------
create table if not exists public.question_bank_merge_log (
  file_id      uuid primary key,
  file_name    text,
  from_product text,
  subject      text,
  moved_at     timestamptz not null default now()
);
alter table public.question_bank_merge_log enable row level security;
revoke all on public.question_bank_merge_log from anon, authenticated;

with qb as (select id from public.products where slug = 'viteee-question-bank'),
start as (select coalesce(max(sort_order), -1) as n from public.product_files where product_id = (select id from qb)),
old_files as (
  select f.id, f.display_name, o.title, coalesce(f.subject, case when o.subject in ('physics', 'chemistry', 'mathematics') then o.subject end) as subject,
         row_number() over (order by case o.subject when 'physics' then 1 when 'chemistry' then 2 when 'mathematics' then 3 else 4 end, f.sort_order, f.created_at) as k
    from public.product_files f join public.products o on o.id = f.product_id
   where o.category = 'question_bank'
),
moved as (
  update public.product_files f
     set product_id = (select id from qb), subject = old_files.subject, sort_order = (select n from start) + old_files.k
    from old_files
   where f.id = old_files.id
  returning f.id
)
insert into public.question_bank_merge_log (file_id, file_name, from_product, subject)
select o.id, o.display_name, o.title, o.subject from old_files o where o.id in (select id from moved)
on conflict (file_id) do nothing;

-- "first file" pointers (old Download links)
update public.products p set file_path = (select f.file_path from public.product_files f where f.product_id = p.id order by f.sort_order, f.created_at limit 1)
 where p.category = 'question_bank' or p.slug = 'viteee-question-bank';

-- ---------- hide the earlier Question Bank products (no deleting) ----------
create table if not exists public.hidden_by_four_courses (
  product_id uuid primary key,
  title      text,
  category   text,
  hidden_at  timestamptz not null default now()
);
alter table public.hidden_by_four_courses enable row level security;
revoke all on public.hidden_by_four_courses from anon, authenticated;

with hidden as (
  update public.products set is_active = false where is_active and category = 'question_bank' returning id, title, category
)
insert into public.hidden_by_four_courses (product_id, title, category) select id, title, category from hidden
on conflict (product_id) do nothing;

-- buyers keep seeing hidden products they bought (same as four-courses.sql)
drop policy if exists "products: buyers read what they bought" on public.products;
create policy "products: buyers read what they bought" on public.products
  for select to authenticated using (public.has_purchased(id));

-- ---------- 3. what happened ----------
select 'PDFs moved into VITEEE Question Bank' as what, count(*)::text as how_many from public.question_bank_merge_log
union all
select 'earlier Question Bank products (now hidden)', string_agg(title || case when is_active then ' (visible)' else '' end, ', ') from public.products where category = 'question_bank'
union all
select 'students who keep access (earlier Question Bank buyers)', count(distinct pu.user_id)::text
  from public.purchases pu join public.products b on b.id = pu.product_id where pu.status = 'paid' and b.category = 'question_bank'
union all
select 'crash courses that include the Question Bank', coalesce(string_agg(title, ', '), 'none') from public.products where category = 'crash_course' and includes_question_bank;
