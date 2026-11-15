// =====================================================================
//  CONTACT NUMBER — SERVER ONLY
//  The full number lives in .env.local / Vercel as CONTACT_PHONE (not
//  NEXT_PUBLIC_), so it is never bundled into browser code. "server-only"
//  makes the build fail if this file is ever imported by browser code.
//  WHO sees it follows Admin → Settings → Contact mode (src/lib/contact-mode.ts):
//    Open    → everyone (the server puts it into the page)
//    Private → only paid students and admins (checked here on every request)
// =====================================================================
import "server-only";
import { cache } from "react";
import { getContactMode } from "./contact-mode";
import { getSession } from "./dashboard";

/** Digits only with country code, e.g. "919876543210" (or null if not set) */
function privateDigits(): string | null {
  const d = (process.env.CONTACT_PHONE ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 ? d : null;
}

/**
 * The WhatsApp number (the same as CONTACT_PHONE unless you set a separate
 * WHATSAPP_PHONE). Who may use it follows the Contact mode.
 */
export function whatsappDigits(): string | null {
  const d = (process.env.WHATSAPP_PHONE ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length >= 11) return d;
  return privateDigits();
}

/**
 * The full number for emails/invoices to students who have ALREADY PAID
 * (in Private mode, never use this for anyone else).
 */
export function fullContactForPaidStudent(): { display: string; tel: string; whatsapp: string } | null {
  const digits = privateDigits();
  if (!digits) return null;
  const local = digits.slice(-10);
  return { display: `+${digits.slice(0, -10)} ${local.slice(0, 5)} ${local.slice(5)}`, tel: `tel:+${digits}`, whatsapp: `https://wa.me/${digits}` };
}

export type ContactAccess =
  | { unlocked: false; reason: "not-logged-in" | "not-paid" | "not-configured" }
  | { unlocked: true; display: string; tel: string; whatsappDigits: string; open: boolean };

/** "919876543210" → { display: "+91 98765 43210", tel: "+919876543210" } */
const pretty = (digits: string) => {
  const local = digits.slice(-10);
  return { display: `+${digits.slice(0, -10)} ${local.slice(0, 5)} ${local.slice(5)}`, tel: `+${digits}` };
};

/**
 * OPEN mode only: the number for everyone (null in Private mode, or when
 * CONTACT_PHONE isn't set). Safe to put into any page in Open mode.
 */
export async function getOpenContact(): Promise<{ display: string; tel: string; waDigits: string } | null> {
  const { mode } = await getContactMode();
  const digits = privateDigits();
  if (mode !== "open" || !digits) return null;
  return { ...pretty(digits), waDigits: whatsappDigits() ?? digits };
}

/**
 * May this visitor see the number?
 *   ✓ everyone, in Open mode
 *   ✓ admins, always
 *   ✓ logged-in users with any purchase marked 'paid'
 *   ✓ logged-in users with a counselling booking whose payment is 'paid'
 * Checked against Supabase on every request (Row Level Security only lets
 * a student read their own purchases and bookings).
 */
export const getContactAccess = cache(async (): Promise<ContactAccess> => {
  const digits = privateDigits();
  if (!digits) return { unlocked: false, reason: "not-configured" };
  const wa = whatsappDigits() ?? digits;
  if ((await getContactMode()).mode === "open") return { unlocked: true, ...pretty(digits), whatsappDigits: wa, open: true };

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

  return { unlocked: true, ...pretty(digits), whatsappDigits: wa, open: false };
});
