-- =====================================================================
--  VITEEE FORMULA BOOK — the fifth card in Courses (after the 10-Day course)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run courses-question-bank.sql first; four-courses.sql is recommended.)
--
--  1. Creates "VITEEE Formula Book" (web name viteee-formula-book) as a
--     crash-course type product, so it gets everything the courses have:
--     Physics / Chemistry / Mathematics upload areas, "Move to", subject tabs
--     in My Courses, watermarked Open PDF / Download. Neutral placeholder text
--     and price; it starts HIDDEN — set the price and text in Admin → Products,
--     then switch "Visible on website" on. If it already exists, nothing of
--     yours is overwritten.
--  2. HIDES every other product with "Formula Book" in its title (e.g. the
--     separate Physics / Chemistry / Mathematics formula books). Nothing is
--     deleted; buyers keep them in My Courses (same rule as four-courses.sql).
--  3. The last query lists what this file hid.
-- =====================================================================

-- ---------- 1. the product ----------
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, details)
select 'VITEEE Formula Book', 'viteee-formula-book',
       'All important Physics, Chemistry and Mathematics formulas in one place.',
       'crash_course', 299, null, false, false, 5,
       jsonb_build_object(
         'short', 'All important Physics, Chemistry and Mathematics formulas in one place.',
         'who_for', jsonb_build_array('Students preparing for VITEEE who want a quick formula revision'))
 where not exists (select 1 from public.products where slug = 'viteee-formula-book');

update public.products set category = 'crash_course', sort_order = 5 where slug = 'viteee-formula-book';

-- ---------- buyers keep hidden products they bought (same as four-courses.sql) ----------
drop policy if exists "products: buyers read what they bought" on public.products;
create policy "products: buyers read what they bought" on public.products
  for select to authenticated using (public.has_purchased(id));

create or replace function public.get_product_content(p_product_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select p.content_links
  from public.products p
  where p.id = p_product_id
    and (public.is_admin() or public.has_purchased(p.id) or (p.is_active and p.is_free));
$$;

-- ---------- 2. hide the other formula books (no deleting) ----------
create table if not exists public.hidden_by_four_courses (
  product_id uuid primary key,
  title      text,
  category   text,
  hidden_at  timestamptz not null default now()
);
alter table public.hidden_by_four_courses enable row level security;
revoke all on public.hidden_by_four_courses from anon, authenticated;

with hidden as (
  update public.products set is_active = false
   where is_active and slug <> 'viteee-formula-book' and title ilike '%formula book%'
  returning id, title, category
)
insert into public.hidden_by_four_courses (product_id, title, category)
select id, title, category from hidden
on conflict (product_id) do nothing;

-- ---------- 3. the list ----------
select p.title as "formula book", p.category, p.is_active as visible,
       (select count(*) from public.purchases pu where pu.product_id = p.id and pu.status = 'paid') as "buyers (keep access)",
       (select count(*) from public.product_files f where f.product_id = p.id) as "PDFs"
  from public.products p
 where p.title ilike '%formula book%'
 order by p.slug = 'viteee-formula-book' desc, p.title;
