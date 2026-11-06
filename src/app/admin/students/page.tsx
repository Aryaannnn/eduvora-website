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
  const [profiles, purchases, paidCounselling, overrides, signIn] = await Promise.all([
    s.supabase.from("profiles").select("id,full_name,email,phone,role,created_at").order("created_at", { ascending: false }).limit(2000),
    s.supabase.from("purchases").select("user_id,status,products(title)").eq("status", "paid").limit(10000),
    // Same rule as has_predictor_access() in supabase/predictor-access.sql
    s.supabase.from("bookings").select("user_id").eq("payment_status", "paid").in("status", ["confirmed", "completed"]).limit(10000),
    s.supabase.from("predictor_access_overrides").select("user_id,has_access").limit(10000),
    loadSignInMethods(),
  ]);
  if (profiles.error) return <p className="card p-6 text-red-600">Could not load students: {profiles.error.message}</p>;

  const bought = new Map<string, string[]>();
  for (const p of (purchases.data ?? []) as unknown as { user_id: string; products: { title: string } | null }[]) {
    bought.set(p.user_id, [...(bought.get(p.user_id) ?? []), p.products?.title ?? "Product"]);
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
    predictor: predictorFor(p.id as string, p.role as string),
    signedUpWith: signIn.get(p.id as string) ?? [],
  })) as AdminStudent[];
  const setupMissing = !!overrides.error;
  return <StudentsManager students={students} currentUserId={s.user.id} setupMissing={setupMissing} />;
}
