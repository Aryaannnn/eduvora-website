-- =====================================================================
--  MARKS OUT OF 500 · 700+ STUDENTS · HOURS 10 AM – 6 PM
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  1. VITEEE is now marked out of 500:
--     • rank_data, predictions and bookings accept marks 0–500
--     • your EXISTING marks → rank bands (and the marks students already
--       typed in predictions / bookings) are multiplied by 4, ONCE.
--       A marker (predictor_settings.marks_scale) stops a second run from
--       multiplying again, and bands already on the 500 scale are never touched.
--     ⚠️ ×4 only rescales the old numbers. If you have the real 2026 marks-vs-rank
--        data out of 500, enter it in Admin → Predictor instead.
--  2. "Students guided" 1000 → 700 (Admin → Settings → Our results) and the
--     default "Why EDUVORA?" card "1,000+ students guided" → "700+" — only if
--     they still have those exact old values (your own edits stay).
--  3. Contact mode text: "10 AM to 8 PM" → "10 AM to 6 PM" (only that phrase).
-- =====================================================================

-- ---------- 1. marks out of 500 ----------
do $$
declare
  scale integer;
begin
  if to_regclass('public.predictor_settings') is not null then
    alter table public.predictor_settings add column if not exists marks_scale integer not null default 125;
  end if;

  if to_regclass('public.rank_data') is not null then
    alter table public.rank_data drop constraint if exists rank_data_min_marks_check;
    alter table public.rank_data drop constraint if exists rank_data_max_marks_check;
    alter table public.rank_data add constraint rank_data_min_marks_check check (min_marks between 0 and 500);
    alter table public.rank_data add constraint rank_data_max_marks_check check (max_marks between 0 and 500);
  end if;
  if to_regclass('public.predictions') is not null then
    alter table public.predictions drop constraint if exists predictions_marks_check;
    alter table public.predictions add constraint predictions_marks_check check (marks is null or marks between 0 and 500);
  end if;
  alter table public.bookings drop constraint if exists bookings_expected_marks_check;
  alter table public.bookings add constraint bookings_expected_marks_check check (expected_marks is null or expected_marks between 0 and 500);

  -- Convert once: only while the marker says 125 AND the bands still look like the old scale
  if to_regclass('public.predictor_settings') is not null and to_regclass('public.rank_data') is not null then
    select marks_scale into scale from public.predictor_settings where id = 1;
    if coalesce(scale, 125) = 125 then
      if coalesce((select max(max_marks) from public.rank_data), 0) <= 125 then
        update public.rank_data set min_marks = min_marks * 4, max_marks = max_marks * 4;
        if to_regclass('public.predictions') is not null then
          update public.predictions set marks = marks * 4 where marks is not null and marks <= 125;
        end if;
        update public.bookings set expected_marks = expected_marks * 4 where expected_marks is not null and expected_marks <= 125;
      end if;
      update public.predictor_settings set marks_scale = 500 where id = 1;
    end if;
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
