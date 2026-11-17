-- =====================================================================
--  THE FOUR CRASH COURSES (60 / 45 / 30 / 10 days, Physics · Chemistry · Maths)
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  Run supabase/courses-question-bank.sql FIRST (subjects on PDFs).
--
--  1. Makes sure the four courses exist (reuses the ones with these web
--     names) in this order: 60-Day, 45-Day, 30-Day, 10-Day.
--     New ones get neutral placeholder text and a placeholder price and stay
--     HIDDEN — set the real price and text in Admin → Products, then switch
--     "Visible on website" on. Existing text is never overwritten.
--  2. HIDES every other crash course (and any other product called
--     "... Crash Course", e.g. the old Chemistry-only ones) by switching it
--     off. Nothing is deleted, and everyone who bought them keeps access
--     (My Courses & Material, PDFs, links).
--  3. The last query LISTS what this file hid (and everything still hidden).
-- =====================================================================

-- ---------- 1. the four courses ----------
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, details)
select v.title, v.slug, v.descr, 'crash_course', v.price, null, false, false, v.sort_order,
       jsonb_build_object('duration', v.duration, 'short', v.descr,
                          'who_for', jsonb_build_array('Students preparing for VITEEE who want a structured PCM revision'))
  from (values
    ('VITEEE 60-Day Crash Course', 'viteee-60-day-crash-course', 'Complete PCM revision in 60 days with chapter-wise PDF notes.', 2499, 1, '60 days'),
    ('VITEEE 45-Day Crash Course', 'viteee-45-day-crash-course', 'Complete PCM revision in 45 days with chapter-wise PDF notes.', 1999, 2, '45 days'),
    ('VITEEE 30-Day Crash Course', 'viteee-30-day-crash-course', 'Complete PCM revision in 30 days with chapter-wise PDF notes.', 1499, 3, '30 days'),
    ('VITEEE 10-Day Crash Course', 'viteee-10-day-crash-course', 'Quick PCM revision in 10 days with chapter-wise PDF notes.', 799, 4, '10 days')
  ) as v (title, slug, descr, price, sort_order, duration)
 where not exists (select 1 from public.products x where x.slug = v.slug);

-- order + category (keeps your prices, text and visible switch)
update public.products set category = 'crash_course',
       sort_order = case slug when 'viteee-60-day-crash-course' then 1 when 'viteee-45-day-crash-course' then 2
                              when 'viteee-30-day-crash-course' then 3 else 4 end
 where slug in ('viteee-60-day-crash-course', 'viteee-45-day-crash-course', 'viteee-30-day-crash-course', 'viteee-10-day-crash-course');

-- fill only EMPTY fields with neutral placeholders (your own text is kept)
update public.products p set details = p.details
    || case when coalesce(p.details->>'duration', '') = '' then jsonb_build_object('duration', regexp_replace(p.slug, '^viteee-(\d+)-day-crash-course$', '\1 days')) else '{}'::jsonb end
    || case when coalesce(p.details->>'short', '') = '' then jsonb_build_object('short', coalesce(p.description, 'Complete PCM revision with chapter-wise PDF notes.')) else '{}'::jsonb end
 where slug in ('viteee-60-day-crash-course', 'viteee-45-day-crash-course', 'viteee-30-day-crash-course', 'viteee-10-day-crash-course');

-- ---------- buyers keep seeing what they bought, even when it is hidden ----------
-- (before this, a student could only read VISIBLE products, so a hidden course
--  would have disappeared from its buyers' My Courses & Material)
drop policy if exists "products: buyers read what they bought" on public.products;
create policy "products: buyers read what they bought" on public.products
  for select to authenticated using (public.has_purchased(id));

-- private class links: buyers keep them after the course is hidden too
create or replace function public.get_product_content(p_product_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select p.content_links
  from public.products p
  where p.id = p_product_id
    and (public.is_admin() or public.has_purchased(p.id) or (p.is_active and p.is_free));
$$;

-- ---------- 2. hide every other course (no deleting; buyers keep access) ----------
create table if not exists public.hidden_by_four_courses (
  product_id uuid primary key,
  title      text,
  category   text,
  hidden_at  timestamptz not null default now()
);
alter table public.hidden_by_four_courses enable row level security;   -- admins read it in the SQL editor only
revoke all on public.hidden_by_four_courses from anon, authenticated;

with hidden as (
  update public.products set is_active = false
   where is_active
     and slug not in ('viteee-60-day-crash-course', 'viteee-45-day-crash-course', 'viteee-30-day-crash-course', 'viteee-10-day-crash-course',
                      'viteee-formula-book', 'viteee-question-bank')   -- Formula Book + Question Bank stay
     and (category = 'crash_course' or (category <> 'question_bank' and title ilike '%crash course%'))
  returning id, title, category
)
insert into public.hidden_by_four_courses (product_id, title, category)
select id, title, category from hidden
on conflict (product_id) do nothing;

-- ---------- 3. the list ----------
select h.title as "hidden product", h.category, h.hidden_at,
       (select count(*) from public.purchases pu where pu.product_id = h.product_id and pu.status = 'paid') as "buyers (keep access)"
  from public.hidden_by_four_courses h
 order by h.title;
