import type { Metadata } from "next";
import { Suspense } from "react";
import CouponsManager, { type AdminCoupon, type CouponUse } from "@/components/admin/CouponsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Coupons" };

export default function CouponsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/coupons");
  const [coupons, uses, products] = await Promise.all([
    s.supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    s.supabase
      .from("coupon_redemptions")
      .select("id,coupon_id,user_id,discount,status,created_at,used_at,purchase_id,booking_id,purchases(amount,products(title)),bookings(amount)")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(2000),
    s.supabase.from("products").select("id,title,category,price").eq("is_free", false).order("category").order("sort_order"),
  ]);
  const setupMissing = !!coupons.error;

  const rows = (uses.data ?? []) as unknown as {
    id: string; coupon_id: string; user_id: string; discount: number; status: "used" | "cancelled"; created_at: string; used_at: string | null;
    purchases: { amount: number; products: { title: string } | null } | null; bookings: { amount: number } | null;
  }[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = ids.length ? await s.supabase.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] };
  const who = new Map(((people ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p]));
  const codeOf = new Map(((coupons.data ?? []) as AdminCoupon[]).map((c) => [c.id, c.code]));

  const used = new Map<string, number>();
  for (const r of rows) if (r.status === "used") used.set(r.coupon_id, (used.get(r.coupon_id) ?? 0) + 1);

  const list: CouponUse[] = rows.map((r) => ({
    id: r.id,
    code: codeOf.get(r.coupon_id) ?? "—",
    student: who.get(r.user_id)?.full_name || "Student",
    email: who.get(r.user_id)?.email ?? "",
    item: r.purchases ? r.purchases.products?.title ?? "Purchase" : r.bookings ? "Counselling slot" : "—",
    paid: r.purchases?.amount ?? r.bookings?.amount ?? null,
    discount: r.discount,
    status: r.status,
    at: r.used_at ?? r.created_at,
  }));

  return (
    <CouponsManager
      coupons={((coupons.data ?? []) as AdminCoupon[]).map((c) => ({ ...c, used: used.get(c.id) ?? 0 }))}
      uses={list}
      products={(products.data ?? []) as { id: string; title: string; category: string; price: number }[]}
      setupMissing={setupMissing}
    />
  );
}
