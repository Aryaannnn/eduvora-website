import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsManager, { type AdminReview } from "@/components/admin/ReviewsManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/reviews");
  const { data, error } = await s.supabase.from("reviews").select("id,name,type,rating,comment,photo_url,is_approved,created_at").order("created_at", { ascending: false });
  if (error) return <p className="card p-6 text-red-600">Could not load reviews: {error.message}</p>;
  return <ReviewsManager reviews={(data ?? []) as AdminReview[]} />;
}
