// The four crash courses + the Formula Book shown on the website, in this order (web names / slugs).
// ✏️ Their price, text, start date and "Visible" switch: Admin → Products.
//    Every other crash course is hidden (supabase/four-courses.sql) — buyers keep access.
export const COURSE_SLUGS = [
  "viteee-60-day-crash-course",
  "viteee-45-day-crash-course",
  "viteee-30-day-crash-course",
  "viteee-10-day-crash-course",
  "viteee-formula-book", // works exactly like a course (Physics / Chemistry / Mathematics PDFs)
] as const;

export const FORMULA_BOOK_SLUG = "viteee-formula-book";
export const isFormulaBook = (slug: string) => slug === FORMULA_BOOK_SLUG;

export const isMainCourse = (slug: string) => (COURSE_SLUGS as readonly string[]).includes(slug);

/** Sort courses into the fixed order above (others, if any, go last). */
export function inCourseOrder<T extends { slug: string }>(list: T[]): T[] {
  const rank = (s: string) => {
    const i = (COURSE_SLUGS as readonly string[]).indexOf(s);
    return i === -1 ? 99 : i;
  };
  return [...list].sort((a, b) => rank(a.slug) - rank(b.slug));
}

/** "viteee-60-day-crash-course" / "60 days" → "60 Days" (the badge on cards and the course page) */
export function durationBadge(slug: string, duration?: string) {
  if (isFormulaBook(slug)) return "Formula Book";
  const n = slug.match(/(\d+)-day/)?.[1] ?? duration?.match(/(\d+)/)?.[1];
  return n ? `${n} Days` : duration || "";
}
