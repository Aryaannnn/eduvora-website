"use server";

// "Complete your profile" and My Profile → Save: name, mobile number, class / year.
// Same rules as the database (supabase/phone-required.sql): valid Indian mobile,
// stored as +91XXXXXXXXXX, one number per account.
import { cookies } from "next/headers";
import { getSession } from "./dashboard";
import { CLASS_YEARS, normalizeINPhone, PHONE_INVALID, PHONE_OK_COOKIE, PHONE_TAKEN } from "./phone";
import { getAdminSupabase } from "./supabase/admin";

export type ProfileResult = { ok: true } | { ok: false; error: string; field?: "name" | "phone" | "classYear" };

export async function saveMyProfile(input: { fullName: string; phone: string; classYear?: string; requireClassYear?: boolean }): Promise<ProfileResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  const fullName = String(input.fullName ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (fullName.length < 2) return { ok: false, error: "Please enter your full name.", field: "name" };
  const phone = normalizeINPhone(input.phone);
  if (!phone) return { ok: false, error: PHONE_INVALID, field: "phone" };
  const classYear = String(input.classYear ?? "");
  if (classYear && !(CLASS_YEARS as readonly string[]).includes(classYear)) return { ok: false, error: "Please choose your class / year.", field: "classYear" };
  if (input.requireClassYear && !classYear) return { ok: false, error: "Please choose your class / year.", field: "classYear" };

  // Already on another account? (old numbers may be saved as 91XXXXXXXXXX)
  const db = getAdminSupabase();
  if (db) {
    const { data: other } = await db.from("profiles").select("id").in("phone", [phone, phone.slice(1), phone.slice(3)]).neq("id", s.user.id).limit(1);
    if (other?.length) return { ok: false, error: PHONE_TAKEN, field: "phone" };
  }

  const patch: Record<string, string> = { full_name: fullName, phone, ...(classYear ? { class_year: classYear } : {}) };
  let { error } = await s.supabase.from("profiles").update(patch).eq("id", s.user.id);
  if (error && /class_year/.test(error.message)) {
    // supabase/phone-required.sql not run yet → save without class / year
    delete patch.class_year;
    ({ error } = await s.supabase.from("profiles").update(patch).eq("id", s.user.id));
  }
  if (error) {
    if (/duplicate|unique|profiles_phone_uidx/i.test(error.message)) return { ok: false, error: PHONE_TAKEN, field: "phone" };
    if (/invalid_phone/.test(error.message)) return { ok: false, error: PHONE_INVALID, field: "phone" };
    return { ok: false, error: "Could not save. Please try again." };
  }
  // the proxy stops asking for this account
  (await cookies()).set(PHONE_OK_COOKIE, s.user.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { ok: true };
}
