// =====================================================================
//  PRIVATE CONTACT NUMBER — SERVER ONLY
//  The full number lives in .env.local as CONTACT_PHONE (not NEXT_PUBLIC_),
//  so it is never bundled into browser code. "server-only" makes the build
//  fail if this file is ever imported by browser code by mistake.
// =====================================================================
import "server-only";
import { cache } from "react";
import { getSession } from "./dashboard";

/** Digits only with country code, e.g. "919876543210" (or null if not set) */
function privateDigits(): string | null {
  const d = (process.env.CONTACT_PHONE ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 ? d : null;
}

/**
 * The full number for emails to students who have ALREADY PAID
 * (booking confirmation). Never use this for anyone else.
 */
export function fullContactForPaidStudent(): { display: string; tel: string; whatsapp: string } | null {
  const digits = privateDigits();
  if (!digits) return null;
  const local = digits.slice(-10);
  return { display: `+${digits.slice(0, -10)} ${local.slice(0, 5)} ${local.slice(5)}`, tel: `tel:+${digits}`, whatsapp: `https://wa.me/${digits}` };
}

export type ContactAccess =
  | { unlocked: false; reason: "not-logged-in" | "not-paid" | "not-configured" }
  | { unlocked: true; display: string; tel: string; whatsappDigits: string };

/**
 * Has this visitor earned the direct number?
 *   ✓ admins, always
 *   ✓ logged-in users with any purchase marked 'paid'
 *   ✓ logged-in users with a counselling booking whose payment is 'paid'
 * Checked against Supabase on every request (Row Level Security only lets
 * a student read their own purchases and bookings).
 */
export const getContactAccess = cache(async (): Promise<ContactAccess> => {
  const digits = privateDigits();
  if (!digits) return { unlocked: false, reason: "not-configured" };

  const session = await getSession();
  if (!session) return { unlocked: false, reason: "not-logged-in" };

  let allowed = session.profile?.role === "admin";
  if (!allowed) {
    const [purchases, bookings] = await Promise.all([
      session.supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).eq("status", "paid").gt("amount", 0), // free items don't count
      session.supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).eq("payment_status", "paid"),
    ]);
    allowed = (purchases.count ?? 0) > 0 || (bookings.count ?? 0) > 0;
  }
  if (!allowed) return { unlocked: false, reason: "not-paid" };

  // "919876543210" → "+91 98765 43210"
  const local = digits.slice(-10);
  const cc = digits.slice(0, -10);
  return { unlocked: true, display: `+${cc} ${local.slice(0, 5)} ${local.slice(5)}`, tel: `+${digits}`, whatsappDigits: digits };
});
