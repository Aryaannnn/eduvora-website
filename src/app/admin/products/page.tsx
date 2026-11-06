import type { Metadata } from "next";
import { Suspense } from "react";
import ProductsManager, { type AdminProduct } from "@/components/admin/ProductsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/products");
  const { data, error } = await s.supabase
    .from("products")
    .select("id,title,slug,description,category,college,price,original_price,is_free,is_active,thumbnail_url,file_path,details,sort_order,created_at")
    .neq("category", "counselling_package") // packages are managed in Admin → Packages
    .order("category")
    .order("sort_order")
    .order("created_at");
  if (error) return <p className="card p-6 text-red-600">Could not load products: {error.message}</p>;

  // Files per product + download counts + total storage used
  const [files, used] = await Promise.all([
    s.supabase.from("product_files").select("product_id,size_bytes,download_count").limit(20000),
    s.supabase.rpc("materials_storage_used"),
  ]);
  const per = new Map<string, { count: number; downloads: number }>();
  let filesBytes = 0;
  for (const f of (files.data ?? []) as { product_id: string; size_bytes: number; download_count: number }[]) {
    const x = per.get(f.product_id) ?? { count: 0, downloads: 0 };
    per.set(f.product_id, { count: x.count + 1, downloads: x.downloads + Number(f.download_count) });
    filesBytes += Number(f.size_bytes);
  }
  const products = ((data ?? []) as AdminProduct[]).map((p) =>
    files.error ? p : { ...p, files_count: per.get(p.id)?.count ?? 0, downloads: per.get(p.id)?.downloads ?? 0 },
  );
  return <ProductsManager products={products} storage={{ usedBytes: used.error ? null : Number(used.data ?? 0), filesBytes }} />;
}
