// A student's access per product (server only; their own purchases via RLS).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MyAccess = { until: string | null; ended: boolean; purchaseId: string };

/** product id → the BEST access the student has (lifetime wins, else the latest end). null = SQL not run yet. */
export async function loadMyAccess(supabase: SupabaseClient, userId: string): Promise<Map<string, MyAccess> | null> {
  const { data, error } = await supabase.from("purchases").select("id,product_id,access_until").eq("user_id", userId).eq("status", "paid");
  if (error) return null;
  const out = new Map<string, MyAccess>();
  const now = Date.now();
  for (const r of (data ?? []) as { id: string; product_id: string; access_until: string | null }[]) {
    const cur = out.get(r.product_id);
    const better = !cur || (cur.until !== null && (r.access_until === null || new Date(r.access_until).getTime() > new Date(cur.until).getTime()));
    if (better) out.set(r.product_id, { purchaseId: r.id, until: r.access_until, ended: !!r.access_until && new Date(r.access_until).getTime() <= now });
  }
  return out;
}

/** Products whose access ends within `days` days (for the reminder banner) */
export function endingSoon(access: Map<string, MyAccess> | null, days = 7) {
  const now = Date.now();
  return [...(access ?? new Map<string, MyAccess>()).entries()].filter(([, a]) => a.until && !a.ended && new Date(a.until).getTime() - now <= days * 86_400_000);
}
