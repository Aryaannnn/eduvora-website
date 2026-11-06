import type { Metadata } from "next";
import { Suspense } from "react";
import StudentsManager, { type AdminStudent } from "@/components/admin/StudentsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Students" };

/**
 * How each user signs in ("google", "email", "phone"), read from Supabase Auth
 * with the server-only key. Returns an empty map if that key isn't set.
 */
async function loadSignInMethods(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const db = getAdminSupabase();
  if (!db) return out;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn("[admin] could not read sign-in methods:", error.message);
      break;
    }
    for (const u of data.users) {
      const list = (u.app_metadata?.providers as string[] | undefined) ?? (u.app_metadata?.provider ? [String(u.app_metadata.provider)] : []);
      out.set(u.id, list);
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/students");
  const [profiles, purchases, paidCounselling, overrides, signIn, freeAttempts, pkgPurchases, creditBookings, adjustments] = await Promise.all([
    s.supabase.from("profiles").select("id,full_name,email,phone,role,created_at").order("created_at", { ascending: false }).limit(2000),
    s.supabase.from("purchases").select("user_id,amount,created_at,products(title,is_free)").eq("status", "paid").order("created_at", { ascending: false }).limit(10000),
    // Same rule as has_predictor_access() in supabase/predictor-access.sql
    s.supabase.from("bookings").select("user_id").eq("payment_status", "paid").in("status", ["confirmed", "completed"]).limit(10000),
    s.supabase.from("predictor_access_overrides").select("user_id,has_access").limit(10000),
    loadSignInMethods(),
    // Free tests each student took (admins can read every attempt)
    s.supabase.from("test_attempts").select("user_id,started_at,tests!inner(title,is_free)").eq("tests.is_free", true).order("started_at", { ascending: false }).limit(10000),
    // Session credits (same rule as session_credits() in supabase/packages.sql) — empty until packages.sql is run
    s.supabase.from("purchases").select("user_id,sessions_granted,sessions_unlimited").eq("status", "paid").or("sessions_granted.not.is.null,sessions_unlimited.eq.true").limit(20000),
    s.supabase.from("bookings").select("user_id").eq("paid_with", "credit").in("status", ["pending", "confirmed", "completed"]).limit(20000),
    s.supabase.from("session_credit_adjustments").select("user_id,delta").limit(20000),
  ]);
  if (profiles.error) return <p className="card p-6 text-red-600">Could not load students: {profiles.error.message}</p>;

  // Paid items vs FREE items (₹0 unlocks + free tests taken) — for follow-up calls
  const bought = new Map<string, string[]>();
  const freeItems = new Map<string, AdminStudent["freeItems"]>();
  const addFree = (uid: string, item: AdminStudent["freeItems"][number]) => freeItems.set(uid, [...(freeItems.get(uid) ?? []), item]);
  for (const p of (purchases.data ?? []) as unknown as { user_id: string; amount: number; created_at: string; products: { title: string; is_free: boolean } | null }[]) {
    const title = p.products?.title ?? "Product";
    if (p.amount === 0 || p.products?.is_free) addFree(p.user_id, { title, kind: "item", at: p.created_at });
    else bought.set(p.user_id, [...(bought.get(p.user_id) ?? []), title]);
  }
  const creditsSetup = !pkgPurchases.error && !adjustments.error;
  const cred = new Map<string, { total: number; used: number; unlimited: boolean }>();
  const c = (uid: string) => cred.get(uid) ?? (cred.set(uid, { total: 0, used: 0, unlimited: false }), cred.get(uid)!);
  for (const p of (pkgPurchases.data ?? []) as { user_id: string; sessions_granted: number | null; sessions_unlimited: boolean }[]) {
    const x = c(p.user_id);
    x.total += p.sessions_granted ?? 0;
    x.unlimited ||= p.sessions_unlimited;
  }
  for (const a of (adjustments.data ?? []) as { user_id: string; delta: number }[]) c(a.user_id).total += a.delta;
  for (const b of (creditBookings.data ?? []) as { user_id: string }[]) c(b.user_id).used += 1;

  const seenTest = new Set<string>();
  for (const a of (freeAttempts.data ?? []) as unknown as { user_id: string; started_at: string; tests: { title: string } | null }[]) {
    const title = a.tests?.title ?? "Free test";
    if (seenTest.has(`${a.user_id}|${title}`)) continue; // newest attempt only
    seenTest.add(`${a.user_id}|${title}`);
    addFree(a.user_id, { title, kind: "test", at: a.started_at });
  }
  const paid = new Set((paidCounselling.data ?? []).map((b) => b.user_id as string));
  const override = new Map((overrides.data ?? []).map((o) => [o.user_id as string, o.has_access as boolean]));
  const predictorFor = (id: string, role: string): AdminStudent["predictor"] => {
    const o = override.get(id) ?? null;
    if (role === "admin") return { access: true, reason: "admin", override: o };
    if (o === true) return { access: true, reason: "given", override: o };
    if (o === false) return { access: false, reason: "removed", override: o };
    return paid.has(id) ? { access: true, reason: "paid", override: null } : { access: false, reason: "none", override: null };
  };
  const students: AdminStudent[] = (profiles.data ?? []).map((p) => ({
    ...p,
    bought: bought.get(p.id) ?? [],
    freeItems: freeItems.get(p.id as string) ?? [],
    credits: creditsSetup ? (cred.get(p.id as string) ?? { total: 0, used: 0, unlimited: false }) : null,
    predictor: predictorFor(p.id as string, p.role as string),
    signedUpWith: signIn.get(p.id as string) ?? [],
  })) as AdminStudent[];
  const setupMissing = !!overrides.error;
  return <StudentsManager students={students} currentUserId={s.user.id} setupMissing={setupMissing} />;
}
