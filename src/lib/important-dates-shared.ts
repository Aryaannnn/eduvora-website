// Shared by the website and the admin screen (safe in the browser — no database code).
export type DateCategory = "application" | "exam" | "admit_card" | "result" | "counselling" | "fees" | "other";
export type DateStatus = "upcoming" | "ongoing" | "completed";

export const CATEGORY_LABEL: Record<DateCategory, string> = {
  application: "Application",
  exam: "Exam",
  admit_card: "Admit card / slot booking",
  result: "Result",
  counselling: "Counselling",
  fees: "Fee payment",
  other: "Other",
};

/** Upcoming (before start) · Ongoing (start → end) · Completed (after end). Dates are "YYYY-MM-DD" in India time. */
export function statusFor(start: string, end: string | null, today: string): DateStatus {
  if (today < start) return "upcoming";
  if (today <= (end ?? start)) return "ongoing";
  return "completed";
}
