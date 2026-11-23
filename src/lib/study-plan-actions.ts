"use server";

// Student: "Mark day as done" and "My start date" — saved with the student's OWN
// login, so the database only allows their own rows, for courses they can open.
import { getSession } from "./dashboard";

const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
type R = { ok: true } | { ok: false; error: string };
const friendly = (m: string) => (/row-level security|violates/i.test(m) ? "You don't have access to this course." : /study_plan/.test(m) && /exist|schema cache/i.test(m) ? "The study plan isn't switched on yet." : "Could not save. Please try again.");

export async function setPlanDayDone(dayId: string, done: boolean): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  if (!isId(dayId)) return { ok: false, error: "Day not found." };
  const { error } = done
    ? await s.supabase.from("study_plan_progress").upsert({ user_id: s.user.id, day_id: dayId }, { onConflict: "user_id,day_id", ignoreDuplicates: true })
    : await s.supabase.from("study_plan_progress").delete().eq("user_id", s.user.id).eq("day_id", dayId);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** null = back to the default (enrolment date) */
export async function setPlanStart(productId: string, date: string | null): Promise<R> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  if (!isId(productId)) return { ok: false, error: "Course not found." };
  if (date === null) {
    const { error } = await s.supabase.from("study_plan_starts").delete().eq("user_id", s.user.id).eq("product_id", productId);
    return error ? { ok: false, error: friendly(error.message) } : { ok: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { ok: false, error: "Please pick a valid date." };
  const { error } = await s.supabase.from("study_plan_starts").upsert({ user_id: s.user.id, product_id: productId, start_date: date }, { onConflict: "user_id,product_id" });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
