-- =====================================================================
--  GOOGLE SEARCH CONSOLE VERIFICATION (Admin → Settings → "Google Search Console")
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run supabase/price-labels.sql first — it creates display_settings.)
--
--  Adds one text field to the existing settings row. The code you paste in
--  the admin panel is put in every page as
--    <meta name="google-site-verification" content="…">
--  so Google can confirm you own the website. Google shows this code to
--  everyone who opens the page, so it is not a secret.
-- =====================================================================
alter table public.display_settings add column if not exists google_site_verification text;
alter table public.display_settings drop constraint if exists display_settings_gsv_check;
alter table public.display_settings add constraint display_settings_gsv_check
  check (google_site_verification is null or google_site_verification ~ '^[A-Za-z0-9_-]{10,100}$');
-- the website reads it (anyone can read display_settings; only admins can change it)
select id, google_site_verification from public.display_settings;
