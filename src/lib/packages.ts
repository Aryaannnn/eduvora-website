// =====================================================================
//  COUNSELLING PACKAGES + SESSION CREDITS
//  • A package is a product with category "counselling_package"
//    (edit them in Admin → Packages). Bought with the normal Razorpay
//    flow → invoice, emails, Admin → Payments, refunds all work as usual.
//  • Credits are counted in Supabase: session_credits() (supabase/packages.sql)
//    = sessions from paid packages + admin adjustments − bookings made with a credit.
// =====================================================================
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_COLUMNS } from "./data";
import { getPublicSupabase } from "./supabase/public";
import type { Product } from "./types";

export type Package = Product & {
  package_sessions: number | null;
  package_unlimited: boolean;
  details: Product["details"] & { tagline?: string; popular?: boolean; features?: string[] };
};

export type Credits = { total: number; used: number; remaining: number; unlimited: boolean };

/** Active packages for the pricing cards (cached; empty until packages.sql is run). */
export async function getPackages(): Promise<Package[]> {
  "use cache";
  cacheTag("products");
  const supabase = getPublicSupabase();
  if (!supabase) return (cacheLife("minutes"), []);
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS},package_sessions,package_unlimited`)
    .eq("category", "counselling_package")
    .eq("is_active", true)
    .order("sort_order")
    .order("price");
  if (error) {
    console.warn("Supabase getPackages:", error.message, "(run supabase/packages.sql?)");
    cacheLife({ stale: 300, revalidate: 30, expire: 3600 });
    return [];
  }
  cacheLife("minutes");
  return (data ?? []) as unknown as Package[];
}

/** "3 sessions" / "1 session" / "Unlimited sessions" */
export function sessionsLabel(p: Pick<Package, "package_sessions" | "package_unlimited">) {
  if (p.package_unlimited) return "Unlimited sessions";
  const n = p.package_sessions ?? 1;
  return `${n} session${n === 1 ? "" : "s"}`;
}

/** The student's credits (null if not logged in or packages.sql not run yet). */
export async function getCredits(supabase: SupabaseClient, userId?: string): Promise<Credits | null> {
  const { data, error } = await supabase.rpc("session_credits", userId ? { p_user: userId } : {});
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Credits | undefined;
  return row ? { total: +row.total, used: +row.used, remaining: +row.remaining, unlimited: !!row.unlimited } : null;
}

/** True if the student has at least one session they can book with. */
export const canUseCredit = (c: Credits | null) => !!c && (c.unlimited || c.remaining > 0);

/** "Sessions left: 2 of 3" / "Unlimited sessions" */
export function creditsLine(c: Credits) {
  if (c.unlimited) return "Unlimited sessions (until admission)";
  return `Sessions left: ${c.remaining} of ${c.total}`;
}
