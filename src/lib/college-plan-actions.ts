"use server";

// Admin / counsellor: save a booking's college plan as a draft or publish it.
// Runs with the staff member's OWN login, so Row Level Security applies
// (supabase/college-plans.sql → only staff with a 2-step login may write).
import { revalidatePath } from "next/cache";
import { staffOrError, isError, type ActionResult } from "./admin";
import { type CollegePlanInput } from "./college-plan";

const clean = (list: unknown, max = 20, len = 200) =>
  (Array.isArray(list) ? list : []).map((x) => String(x ?? "").trim().slice(0, len)).filter(Boolean).slice(0, max);

export async function saveCollegePlan(bookingId: string, input: CollegePlanInput, publish: boolean): Promise<ActionResult<{ id: string }>> {
  const s = await staffOrError();
  if (isError(s)) return s;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return { ok: false, error: "Booking not found." };

  const row = {
    booking_id: bookingId,
    status: publish ? "published" : "draft",
    campuses: clean(input.campuses, 10),
    branches: clean(input.branches, 15),
    fee_category: String(input.fee_category ?? "").trim().slice(0, 60) || null,
    choice_order: clean(input.choice_order, 30),
    next_steps: clean(input.next_steps, 20),
    notes: String(input.notes ?? "").trim().slice(0, 4000) || null,
    counsellor_id: s.user.id,
    counsellor_name: s.profile?.full_name || s.user.email?.split("@")[0] || "EDUVORA counsellor",
  };
  if (publish && row.campuses.length === 0 && row.branches.length === 0 && row.choice_order.length === 0) {
    return { ok: false, error: "Add at least the recommended campuses, branches or choice-filling order before publishing." };
  }

  const { data, error } = await s.supabase.from("college_plans").upsert(row, { onConflict: "booking_id" }).select("id").single();
  if (error) {
    if (/college_plans/.test(error.message) && /exist|schema cache/i.test(error.message)) return { ok: false, error: "Run supabase/college-plans.sql in Supabase first." };
    if (/row-level security|violates/i.test(error.message)) return { ok: false, error: "Only admins and counsellors (with 2-step login) can save plans." };
    if (/foreign key/i.test(error.message)) return { ok: false, error: "This booking no longer exists." };
    return { ok: false, error: error.message };
  }
  await s.supabase
    .rpc("log_admin_event", {
      p_action: publish ? "college_plan.publish" : "college_plan.draft",
      p_summary: `${publish ? "Published" : "Saved a draft of"} the college plan for booking ${bookingId.slice(0, 8)}`,
      p_details: { booking_id: bookingId },
    })
    .then(() => null, () => null);
  revalidatePath("/admin/bookings");
  return { ok: true, data: { id: data.id as string }, message: publish ? "Published — the student can see it now." : "Draft saved (the student can't see it yet)." };
}

/** Back to draft (the student no longer sees it). */
export async function unpublishCollegePlan(bookingId: string): Promise<ActionResult> {
  const s = await staffOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("college_plans").update({ status: "draft" }).eq("booking_id", bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/bookings");
  return { ok: true, message: "Moved back to draft — hidden from the student." };
}
