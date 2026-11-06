import type { Metadata } from "next";
import { Suspense } from "react";
import PackagesManager, { type AdminPackage } from "@/components/admin/PackagesManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Packages" };

export default function PackagesPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/packages");
  const [pk, sold] = await Promise.all([
    s.supabase
      .from("products")
      .select("id,title,description,price,original_price,is_active,sort_order,package_sessions,package_unlimited,details")
      .eq("category", "counselling_package")
      .order("sort_order")
      .order("price"),
    s.supabase.from("purchases").select("product_id,products!inner(category)").eq("status", "paid").eq("products.category", "counselling_package").limit(20000),
  ]);
  const setupMissing = !!pk.error && /package_sessions|package_unlimited|column/i.test(pk.error.message);
  if (pk.error && !setupMissing) return <p className="card p-6 text-red-600">Could not load packages: {pk.error.message}</p>;

  const count = new Map<string, number>();
  for (const r of (sold.data ?? []) as { product_id: string }[]) count.set(r.product_id, (count.get(r.product_id) ?? 0) + 1);
  const packages = ((pk.data ?? []) as Omit<AdminPackage, "sold">[]).map((p) => ({ ...p, sold: count.get(p.id) ?? 0 }));
  return <PackagesManager packages={packages} setupMissing={setupMissing} />;
}
