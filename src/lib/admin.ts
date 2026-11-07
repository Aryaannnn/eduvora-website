// =====================================================================
//  ADMIN SECURITY (server only)
//  Layers that protect every admin page and action:
//   1. This file checks role = 'admin' ON THE SERVER before anything runs.
//   2. …and that this login passed the 2-step check (authenticator app,
//      "aal2"). No 2FA yet → /admin-verify (set up or enter the code).
//   3. Supabase Row Level Security: is_admin() is only true for role 'admin'
//      WITH a 2FA login (supabase/admin-security.sql) — even if someone
//      skipped layers 1–2, the database says no.
// =====================================================================
import { redirect } from "next/navigation";
import { getSession, type Session } from "./dashboard";

/** true when this login passed the authenticator-app check (verified token claim "aal2"). */
export async function hasAdmin2fa(s: Session): Promise<boolean> {
  const { data } = await s.supabase.auth.getClaims();
  return (data?.claims as { aal?: string } | undefined)?.aal === "aal2";
}

/** For admin PAGES: not logged in → login page; not admin → student dashboard; no 2FA yet → /admin-verify. */
export async function requireAdmin(path = "/admin"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (s.profile?.role !== "admin") redirect("/dashboard");
  if (!(await hasAdmin2fa(s))) redirect(`/admin-verify?next=${encodeURIComponent(path)}`);
  return s;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** For admin ACTIONS (add/edit/delete): returns the session or an error result. */
export async function adminOrError(): Promise<Session | { ok: false; error: string }> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please sign in again." };
  if (s.profile?.role !== "admin") return { ok: false, error: "Only admins can do this." };
  if (!(await hasAdmin2fa(s))) return { ok: false, error: "Please confirm it's you with your authenticator app first — reload the page." };
  return s;
}

export const isError = (x: unknown): x is { ok: false; error: string } =>
  typeof x === "object" && x !== null && "ok" in x && (x as { ok: boolean }).ok === false;

/** Turns database errors into simple English */
export function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") && m.includes("slug")) return "Another product already uses this web name (slug). Please choose a different one.";
  if (m.includes("duplicate key") && m.includes("slots_unique_start")) return "A slot already exists at this date and start time.";
  if (m.includes("duplicate key") && m.includes("invoice")) return "This invoice number is already used.";
  if (m.includes("violates foreign key") && m.includes("purchases")) return "This product has purchases, so it can't be deleted. Hide it instead.";
  if (m.includes("violates foreign key") && m.includes("bookings")) return "This slot has a booking, so it can't be deleted. Mark it unavailable instead.";
  if (m.includes("slots_time_order")) return "End time must be after start time.";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Not allowed — your account is not an admin.";
  return message;
}
