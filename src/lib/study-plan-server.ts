// Study plans for My Courses (server only). Read with the student's OWN login:
// Row Level Security returns plans only for courses they can open, and only
// their own "done" ticks and start dates.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_DAY_COLUMNS, type PlanDay } from "./study-plan";

export type CoursePlan = { days: PlanDay[]; done: string[]; start: string; defaultStart: string };

const istDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** courses: product id + when the student enrolled (purchase date). null = supabase/study-plans.sql not run yet. */
export async function loadCoursePlans(supabase: SupabaseClient, userId: string, courses: { id: string; enrolledAt: string }[]): Promise<Map<string, CoursePlan> | null> {
  const out = new Map<string, CoursePlan>();
  if (!courses.length) return out;
  const ids = courses.map((c) => c.id);
  const { data: days, error } = await supabase.from("study_plan_days").select(PLAN_DAY_COLUMNS).in("product_id", ids).order("day_number").order("created_at");
  if (error) return null;
  if (!days?.length) return out;
  const dayIds = days.map((d) => d.id as string);
  const [{ data: done }, { data: starts }] = await Promise.all([
    supabase.from("study_plan_progress").select("day_id").eq("user_id", userId).in("day_id", dayIds.slice(0, 1000)),
    supabase.from("study_plan_starts").select("product_id,start_date").eq("user_id", userId).in("product_id", ids),
  ]);
  const doneSet = new Set((done ?? []).map((d) => d.day_id as string));
  const startOf = new Map((starts ?? []).map((s) => [s.product_id as string, s.start_date as string]));
  for (const c of courses) {
    const list = (days as PlanDay[]).filter((d) => d.product_id === c.id);
    if (!list.length) continue;
    const defaultStart = istDate(c.enrolledAt);
    out.set(c.id, { days: list, done: list.filter((d) => doneSet.has(d.id)).map((d) => d.id), start: startOf.get(c.id) ?? defaultStart, defaultStart });
  }
  return out;
}
