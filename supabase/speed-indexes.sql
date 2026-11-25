-- =====================================================================
--  SPEED: indexes for the lookups the website makes most often
--  Run in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
--  An index is like the index at the back of a book: the database finds a
--  student's rows directly instead of reading the whole table. Nothing is
--  changed or deleted — only lookups get faster. (Tables that already had
--  the right index are not touched; see the other supabase/*.sql files.)
-- =====================================================================

-- My Courses, the dashboard, "Enrolled" badges, access checks for every PDF:
--   purchases of ONE student, usually only the paid ones, newest first
create index if not exists purchases_user_status_idx on public.purchases (user_id, status, created_at desc);
-- Seats left on a course page, "new material" emails to a course's buyers
create index if not exists purchases_product_status_idx on public.purchases (product_id, status);

-- Dashboard → My Bookings, and "is this slot taken?"
create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_slot_idx on public.bookings (slot_id);

-- Dashboard → Tests / Progress: a student's attempts, newest first; results per test
create index if not exists test_attempts_user_idx on public.test_attempts (user_id, started_at desc);
create index if not exists test_attempts_test_idx on public.test_attempts (test_id);
create index if not exists tests_product_idx on public.tests (product_id);

-- Course lists (Courses page, home page, admin): by category, visible ones, in order
create index if not exists products_category_idx on public.products (category, is_active, sort_order);

-- Approved reviews on the home page / Reviews page
create index if not exists reviews_approved_idx on public.reviews (is_approved, created_at desc);

-- Study plans: the days of one course, in order
create index if not exists study_plan_days_product_idx on public.study_plan_days (product_id, day_number);

-- Refresh the database's statistics so it starts using the new indexes at once
analyze public.purchases, public.bookings, public.test_attempts, public.tests, public.products, public.reviews, public.study_plan_days;
