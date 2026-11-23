"use server";

// Admin → Students → "Extend access" (admins only — checked here and in the database).
import { revalidatePath } from "next/cache";
import { adminOrError, isError, type ActionResult } from "@/lib/admin";

/** until: "YYYY-MM-DD" (end of that day, India time) or null = lifetime */
export async function extendStudentAccess(purchaseId: string, until: string | null): Promise<ActionResult<{ until: string | null }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) return { ok: false, error: "Purchase not found." };
  if (until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, error: "Please pick a date." };
  const iso = until ? new Date(`${until}T23:59:59+05:30`).toISOString() : null;
  const { error } = await s.supabase.rpc("extend_access", { p_purchase: purchaseId, p_until: iso });
  if (error) return { ok: false, error: /extend_access/.test(error.message) && /exist|schema cache/i.test(error.message) ? "Run supabase/access-periods.sql in Supabase first." : error.message };
  await s.supabase
    .rpc("log_admin_event", { p_action: "access.extend", p_summary: `Set access ${until ? `until ${until}` : "to lifetime"} for purchase ${purchaseId.slice(0, 8)}`, p_details: { purchase_id: purchaseId, until } })
    .then(() => null, () => null);
  revalidatePath("/admin/students");
  return { ok: true, data: { until: iso }, message: until ? `Access extended until ${until}.` : "Access set to lifetime." };
}
