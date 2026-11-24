-- =====================================================================
--  RANK PREDICTOR: SAMPLE rank data → full marks 400
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  The SAMPLE rank_data still uses the old 0–125 marks, so almost every mark
--  out of 400 was "above the data range" (→ rank ~1). This converts the SAMPLE
--  rows only:
--    • a year whose SAMPLE rows stop at 125 or less  → marks × 3.2
--    • a year whose SAMPLE rows go above 400 (old /500 scale) → marks × 0.8
--    (rounded to whole marks; ranks are not changed)
--  A year that already reaches 400 is left alone, and real (non-sample) rows
--  are never touched. Every change is written to rank_data_rescale_log; the
--  last query shows each row before → after.
-- =====================================================================

-- marks may be 0–400 (older setups allowed only 0–125)
alter table public.rank_data drop constraint if exists rank_data_min_marks_check;
alter table public.rank_data drop constraint if exists rank_data_max_marks_check;

create table if not exists public.rank_data_rescale_log (
  id         bigserial primary key,
  row_id     uuid not null,
  year       integer not null,
  factor     numeric not null,
  old_min    numeric not null,
  old_max    numeric not null,
  new_min    numeric not null,
  new_max    numeric not null,
  min_rank   integer not null,
  max_rank   integer not null,
  done_at    timestamptz not null default now()
);
alter table public.rank_data_rescale_log enable row level security;
revoke all on public.rank_data_rescale_log from anon, authenticated;

do $$
declare
  y record;
  f numeric;
begin
  for y in
    select year, max(max_marks) as top from public.rank_data where is_sample group by year
  loop
    f := case when y.top > 0 and y.top <= 125 then 3.2 when y.top > 400 then 0.8 else null end;
    if f is null then continue; end if;
    insert into public.rank_data_rescale_log (row_id, year, factor, old_min, old_max, new_min, new_max, min_rank, max_rank)
    select id, year, f, min_marks, max_marks, round(min_marks * f), least(400, round(max_marks * f)), min_rank, max_rank
      from public.rank_data where year = y.year and is_sample;
    update public.rank_data
       set min_marks = round(min_marks * f), max_marks = least(400, round(max_marks * f))
     where year = y.year and is_sample;
    raise notice 'Year %: SAMPLE marks × % (was up to %, now up to %)', y.year, f, y.top, least(400, round(y.top * f));
  end loop;
end;
$$;

alter table public.rank_data add constraint rank_data_min_marks_check check (min_marks between 0 and 400);
alter table public.rank_data add constraint rank_data_max_marks_check check (max_marks between 0 and 400);

-- remember that the predictor data is out of 400 (marks-students-hours.sql uses this too)
do $$
begin
  if to_regclass('public.predictor_settings') is not null then
    alter table public.predictor_settings add column if not exists marks_scale integer not null default 125;
    update public.predictor_settings set marks_scale = 400 where id = 1;
  end if;
end;
$$;

-- Before → after (empty if nothing needed converting)
select year, factor, old_min || '–' || old_max as "marks before", new_min || '–' || new_max as "marks after", min_rank || '–' || max_rank as "rank range"
  from public.rank_data_rescale_log order by done_at desc, year, new_min;
