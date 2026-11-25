-- =====================================================================
--  ENGLISH & APTITUDE — a fourth subject for the crash courses
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--  (Run courses-question-bank.sql first — it adds the subject column.)
--
--  Lets a PDF have the subject 'english_aptitude' (next to physics /
--  chemistry / mathematics). Nothing else changes: no PDFs are moved, no
--  text is changed. The website only offers English & Aptitude on the four
--  crash courses (60, 45, 30 and 10-Day); the Formula Book and the Question
--  Bank stay Physics, Chemistry and Mathematics.
-- =====================================================================

alter table public.product_files drop constraint if exists product_files_subject_check;
alter table public.product_files add constraint product_files_subject_check
  check (subject is null or subject in ('physics', 'chemistry', 'mathematics', 'english_aptitude'));

-- Check: PDFs per subject (English & Aptitude shows 0 until you upload some)
select coalesce(subject, '(none)') as subject, count(*) as pdfs
from public.product_files
group by 1
order by 1;
