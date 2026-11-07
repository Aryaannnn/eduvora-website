"use server";

// =====================================================================
//  PRIVACY ACTIONS (for the logged-in student)
//  • acceptPrivacyTerms  — records consent (date + policy version)
//  • deleteMyAccount     — deletes the account after typing DELETE
// =====================================================================
import { siteConfig } from "@/config/site";
import { deleteAccount } from "./account";
import { getSession } from "./dashboard";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function acceptPrivacyTerms(): Promise<Result> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  const { error } = await s.supabase
    .from("profiles")
    .update({ consent_at: new Date().toISOString(), consent_version: siteConfig.policiesUpdated })
    .eq("id", s.user.id);
  if (error) return { ok: false, error: /consent_/.test(error.message) ? "Privacy settings are being set up — please try again later." : error.message };
  return { ok: true };
}

export async function deleteMyAccount(confirm: string): Promise<Result> {
  if (confirm.trim() !== "DELETE") return { ok: false, error: "Please type DELETE (in capital letters) to confirm." };
  const s = await getSession();
  if (!s) return { ok: false, error: "Please log in again." };
  if (s.profile?.role === "admin") return { ok: false, error: "Admin accounts can't be deleted here. Ask another admin to remove your admin role first." };
  const res = await deleteAccount(s.user.id, "student");
  if (!res.ok) return res;
  // the login no longer exists; clear this browser's cookies
  await s.supabase.auth.signOut().catch(() => undefined);
  return { ok: true, message: "Your account has been deleted." };
}
