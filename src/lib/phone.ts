// Indian mobile numbers — the same rules in the browser, on the server and in
// the database (supabase/phone-required.sql → normalize_in_phone):
// 10 digits starting with 6, 7, 8 or 9. Spaces, dashes and a leading
// +91 / 91 / 0 are removed. Stored as +91XXXXXXXXXX.

export const PHONE_INVALID = "Please enter a valid 10-digit mobile number.";
export const PHONE_TAKEN = "This number is already linked to another account. Please log in with that account or contact support.";
export const PHONE_NEEDED = "Please add your mobile number first.";

export const CLASS_YEARS = ["Class 11", "Class 12", "Dropper", "Parent", "Other"] as const;
export type ClassYear = (typeof CLASS_YEARS)[number];

/** "98765 43210" / "+91-98765-43210" / "098765 43210" → "+919876543210"; anything else → null */
export function normalizeINPhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

/** The 10 digits for an input box ("+919876543210" or "919876543210" → "9876543210") */
export const localDigits = (phone: string | null | undefined) => normalizeINPhone(phone)?.slice(3) ?? "";

/** Admins and counsellors never have to add a number */
export const isStaffRole = (role: string | null | undefined) => role === "admin" || role === "counsellor";

/** Must this account add a mobile number before using the site? */
export function needsPhone(profile: { role?: string | null; phone?: string | null } | null | undefined) {
  if (!profile) return false; // no profile row (yet) → the server routes decide
  return !isStaffRole(profile.role) && !normalizeINPhone(profile.phone);
}

/** Cookie the proxy sets once the number is there (value = user id), so it doesn't ask the database on every page */
export const PHONE_OK_COOKIE = "eduvora_pf";

/** Pages a student without a number can still open (the form itself, login / logout, legal pages, contact) */
export const PHONE_FREE_PATHS = [
  "/complete-profile",
  "/auth",
  "/login",
  "/admin-verify",
  "/reset-password",
  "/forgot-password",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-policy",
  "/shipping-policy",
  "/contact",
];
