// College plan after a counselling call (supabase/college-plans.sql) — shared by
// the admin editor, the student's view and the PDF.

export type CollegePlan = {
  id: string;
  booking_id: string;
  student_id: string | null;
  status: "draft" | "published";
  campuses: string[];
  branches: string[];
  fee_category: string | null;
  choice_order: string[];
  next_steps: string[];
  notes: string | null;
  counsellor_name: string | null;
  published_at: string | null;
  seen_at: string | null;
  updated_at: string;
};

export type CollegePlanInput = {
  campuses: string[];
  branches: string[];
  fee_category: string;
  choice_order: string[];
  next_steps: string[];
  notes: string;
};

export const PLAN_COLUMNS = "id,booking_id,student_id,status,campuses,branches,fee_category,choice_order,next_steps,notes,counsellor_name,published_at,seen_at,updated_at";

/** Suggestions for the fee category box (any text is allowed). */
export const FEE_CATEGORY_HINTS = ["Category 1", "Category 2", "Category 3", "Category 4", "Category 5"];

export const PLAN_DISCLAIMER = "This plan is guidance based on available information; final admission depends on official VIT counselling.";

/** One item per line → clean list (empty lines dropped, max items / length) */
export const toLines = (s: string, max = 20, len = 200) =>
  s.split("\n").map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim().slice(0, len)).filter(Boolean).slice(0, max);
