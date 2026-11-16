-- =====================================================================
--  MARKS OUT OF 400 · 700+ STUDENTS · HOURS 10 AM – 6 PM
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  1. VITEEE is marked out of 400:
--     • rank_data, predictions and bookings accept marks 0–400
--     • your EXISTING marks → rank bands (and the marks students already typed
--       in predictions / bookings) are converted ONCE to the 400 scale:
--       × 3.2 if they are out of 125, × 0.8 if an earlier version of this file
--       already made them out of 500 (rank-data marks rounded to whole numbers).
--       A marker (predictor_settings.marks_scale = 400) stops a second run.
--     ⚠️ Converting only rescales the old numbers. If you have the real
--        marks-vs-rank data out of 400, enter it in Admin → Predictor instead.
--  2. "Students guided" 1000 → 700 (Admin → Settings → Our results) and the
--     default "Why EDUVORA?" card "1,000+ students guided" → "700+" — only if
--     they still have those exact old values (your own edits stay).
--  3. Contact mode text: "10 AM to 8 PM" → "10 AM to 6 PM" (only that phrase).
-- =====================================================================

-- ---------- 1. marks out of 400 ----------
-- Works out which scale your data is on, converts it ONCE, then remembers 400:
--   marker 125 (or no marker) and bands up to 125 → × 3.2   (old 125-mark data)
--   marker 500 (an earlier version of this file was run) → × 0.8
--   marker 400 → nothing to do
-- Rank-data marks are rounded to whole numbers.
do $$
declare
  scale  integer;
  top    numeric;
  factor numeric := null;
begin
  if to_regclass('public.predictor_settings') is not null then
    alter table public.predictor_settings add column if not exists marks_scale integer not null default 125;
  end if;

  -- 1) loosen the limits so data on any old scale can be converted
  if to_regclass('public.rank_data') is not null then
    alter table public.rank_data drop constraint if exists rank_data_min_marks_check;
    alter table public.rank_data drop constraint if exists rank_data_max_marks_check;
  end if;
  if to_regclass('public.predictions') is not null then
    alter table public.predictions drop constraint if exists predictions_marks_check;
  end if;
  alter table public.bookings drop constraint if exists bookings_expected_marks_check;

  -- 2) convert once
  if to_regclass('public.predictor_settings') is not null and to_regclass('public.rank_data') is not null then
    select marks_scale into scale from public.predictor_settings where id = 1;
    select max(max_marks) into top from public.rank_data;
    if coalesce(scale, 125) = 500 then
      factor := 0.8;
    elsif coalesce(scale, 125) = 125 and coalesce(top, 0) <= 125 then
      factor := 3.2;
    end if;
    if factor is not null then
      update public.rank_data set min_marks = round(min_marks * factor), max_marks = round(max_marks * factor);
      if to_regclass('public.predictions') is not null then
        update public.predictions set marks = round(marks * factor, 2) where marks is not null;
      end if;
      update public.bookings set expected_marks = round(expected_marks * factor, 2) where expected_marks is not null;
    end if;
    update public.predictor_settings set marks_scale = 400 where id = 1;
  end if;

  -- 3) the new limits: 0–400 (anything above was already out of range)
  if to_regclass('public.predictions') is not null then
    update public.predictions set marks = 400 where marks > 400;
    alter table public.predictions add constraint predictions_marks_check check (marks is null or marks between 0 and 400);
  end if;
  update public.bookings set expected_marks = 400 where expected_marks > 400;
  alter table public.bookings add constraint bookings_expected_marks_check check (expected_marks is null or expected_marks between 0 and 400);
  if to_regclass('public.rank_data') is not null then
    alter table public.rank_data add constraint rank_data_min_marks_check check (min_marks between 0 and 400);
    alter table public.rank_data add constraint rank_data_max_marks_check check (max_marks between 0 and 400);
  end if;
end;
$$;

-- ---------- 2. 700+ students guided (only the untouched old defaults) ----------
do $$
begin
  if to_regclass('public.site_stats') is not null then
    update public.site_stats set value = 700 where label = 'Students guided' and value = 1000;
  end if;
  if to_regclass('public.why_settings') is not null then
    update public.why_settings
       set cards = replace(cards::text, '"title": "1,000+ students guided"', '"title": "700+ students guided"')::jsonb
     where id = 1 and cards::text like '%"title": "1,000+ students guided"%';
  end if;
end;
$$;

-- ---------- 3. business hours in the Contact mode text ----------
do $$
begin
  if to_regclass('public.contact_settings') is not null then
    update public.contact_settings set open_note = replace(open_note, '10 AM to 8 PM', '10 AM to 6 PM')
     where id = 1 and open_note like '%10 AM to 8 PM%';
  end if;
end;
$$;
