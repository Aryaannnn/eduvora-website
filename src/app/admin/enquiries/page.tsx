import type { Metadata } from "next";
import { Suspense } from "react";
import EnquiriesManager, { type AdminEnquiry } from "@/components/admin/EnquiriesManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireStaff } from "@/lib/admin";

export const metadata: Metadata = { title: "Enquiries" };

export default function EnquiriesPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { s, role } = await requireStaff("/admin/enquiries"); // counsellors: view + status (no delete)
  const { data, error } = await s.supabase
    .from("enquiries")
    .select("id,name,phone,email,class_year,message,source,status,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    return (
      <p className="card p-6 text-red-600">
        {missing ? "The enquiries table doesn't exist yet. Run supabase/enquiries.sql in Supabase → SQL Editor." : `Could not load enquiries: ${error.message}`}
      </p>
    );
  }
  return <EnquiriesManager enquiries={(data ?? []) as AdminEnquiry[]} canDelete={role === "admin"} />;
}
