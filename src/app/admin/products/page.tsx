import type { Metadata } from "next";
import { Suspense } from "react";
import ProductsManager, { type AdminProduct } from "@/components/admin/ProductsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import ReaderUsageCard, { type ReaderUsage } from "@/components/admin/ReaderUsageCard";
import { siteConfig } from "@/config/site";

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
  // (content_links is private — never "*"; subject / includes_question_bank need supabase/courses-question-bank.sql)
  const cols = "id,title,slug,description,category,college,price,original_price,is_free,is_active,thumbnail_url,file_path,details,sort_order,created_at";
  const load = (c: string) =>
    s.supabase
      .from("products")
      .select(c)
      .neq("category", "counselling_package") // packages are managed in Admin → Packages
      .order("category")
      .order("sort_order")
      .order("created_at");
  let { data, error } = await load(`${cols},subject,includes_question_bank`);
  if (error) ({ data, error } = await load(cols));
  if (error) return <p className="card p-6 text-red-600">Could not load products: {error.message}</p>;

  // Files per product + download counts + total storage used
  const [files, used, usageRes] = await Promise.all([
    s.supabase.from("product_files").select("product_id,size_bytes,download_count").limit(20000),
    s.supabase.rpc("materials_storage_used"),
    s.supabase.rpc("reader_usage"), // this month (supabase/reader-pages.sql)
  ]);
  const u = (usageRes.data as { views: number; bytes: number; stored: number; files_ready: number; files_waiting: number }[] | null)?.[0];
  const usage: ReaderUsage = usageRes.error || !u ? null : { views: Number(u.views), bytes: Number(u.bytes), stored: Number(u.stored), filesReady: Number(u.files_ready), filesWaiting: Number(u.files_waiting) };
  const per = new Map<string, { count: number; downloads: number }>();
  let filesBytes = 0;
  for (const f of (files.data ?? []) as { product_id: string; size_bytes: number; download_count: number }[]) {
    const x = per.get(f.product_id) ?? { count: 0, downloads: 0 };
    per.set(f.product_id, { count: x.count + 1, downloads: x.downloads + Number(f.download_count) });
    filesBytes += Number(f.size_bytes);
  }
  const products = ((data ?? []) as unknown as AdminProduct[]).map((p) =>
    files.error ? p : { ...p, files_count: per.get(p.id)?.count ?? 0, downloads: per.get(p.id)?.downloads ?? 0 },
  );
  return (
    <ProductsManager products={products} storage={{ usedBytes: used.error ? null : Number(used.data ?? 0), filesBytes }}>
      {siteConfig.inWebsiteReader && <ReaderUsageCard usage={usage} />}
    </ProductsManager>
  );
}
