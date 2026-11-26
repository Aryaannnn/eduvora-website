-- =====================================================================
--  FREE LEAD MAGNET: "VITEEE English & Aptitude Practice Set"
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  Creates a FREE PDF item (price ₹0). It starts HIDDEN, so nobody sees an empty item:
--   1. Admin → Products → "VITEEE English & Aptitude Practice Set" → Files → upload your PDF
--   2. switch "Visible on website" on
--  Then it shows on the home page and on Free Resources with a "Get it Free" button.
--  Visitors sign up / log in, and it unlocks instantly in Dashboard → My Courses &
--  Material (their personal watermarked copy) — and they appear in Admin → Students.
--  Optional: Admin → Settings → Lead capture → choose it as the free guide in the popup.
--  If the item already exists, nothing of yours is overwritten.
-- =====================================================================
insert into public.products (title, slug, description, category, price, original_price, is_free, is_active, sort_order, details)
select 'VITEEE English & Aptitude Practice Set', 'viteee-english-aptitude-practice-set',
       'Free practice questions for the VITEEE English and Aptitude sections, as a PDF in your dashboard. Sign up free to unlock it instantly.',
       'study_material', 0, null, true, false, 0,
       jsonb_build_object(
         'short', 'Free VITEEE English & Aptitude practice questions (PDF).',
         'who_for', jsonb_build_array('Students preparing for the VITEEE English and Aptitude sections'))
 where not exists (select 1 from public.products where slug = 'viteee-english-aptitude-practice-set');

select id, title, is_free, is_active as visible, price from public.products where slug = 'viteee-english-aptitude-practice-set';
