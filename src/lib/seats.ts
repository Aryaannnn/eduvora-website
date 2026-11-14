// Batch seats (crash courses). A seat limit is set per course in Admin → Products
// ("Seat limit" — empty = no limit, nothing is shown). "Seats left" counts REAL
// enrolments only: purchases of that course with status "paid" (refunded,
// failed and abandoned payments don't count). Counted with the server-only key,
// so no student data ever reaches the page — just the number.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "./supabase/admin";

/** Live count (no cache) — used when someone tries to pay. */
export async function countEnrolled(db: SupabaseClient, productId: string): Promise<number | null> {
  const { count, error } = await db.from("purchases").select("id", { count: "exact", head: true }).eq("product_id", productId).eq("status", "paid");
  return error ? null : (count ?? 0);
}

/** A valid seat limit from the course details, or null (= no limit). */
export function seatLimitOf(details: { seat_limit?: unknown } | null | undefined): number | null {
  const n = Number(details?.seat_limit);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Seats left for the course page (refreshed every ~30 seconds). null = no limit or unknown → show nothing. */
export async function getSeatsLeft(productId: string, limit: number | null): Promise<number | null> {
  "use cache";
  cacheTag("products", "seats");
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });
  if (!limit) return null;
  const db = getAdminSupabase();
  if (!db) return null;
  const taken = await countEnrolled(db, productId);
  return taken === null ? null : Math.max(0, limit - taken);
}
