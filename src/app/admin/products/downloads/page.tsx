import type { Metadata } from "next";
import { Suspense } from "react";
import DownloadsReport, { type DownloadRow } from "@/components/admin/DownloadsReport";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";
import { profilesById } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Downloads" };

export default function DownloadsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

async function Content() {
  const s = await requireAdmin("/admin/products/downloads");
  const { data, error } = await s.supabase
    .from("file_downloads")
    .select("id,user_id,file_name,file_type,action,watermarked,status,error,device,created_at,products(title)")
    .gte("created_at", since(30))
    .order("created_at", { ascending: false })
    .limit(10000);
  const raw = (data ?? []) as unknown as (Omit<DownloadRow, "student" | "email" | "product"> & { user_id: string | null; products: { title: string } | null })[];
  const people = await profilesById(s, raw.map((r) => r.user_id).filter(Boolean) as string[]);
  const rows: DownloadRow[] = raw.map((r) => ({
    ...r,
    product: r.products?.title ?? "—",
    student: (r.user_id && people.get(r.user_id)?.full_name) || "Student",
    email: (r.user_id && people.get(r.user_id)?.email) || "",
  }));
  return <DownloadsReport rows={rows} setupMissing={!!error} nowISO={since(0)} />;
}
