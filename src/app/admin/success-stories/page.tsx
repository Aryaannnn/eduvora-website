import type { Metadata } from "next";
import { Suspense } from "react";
import SuccessStoriesManager, { type AdminStory } from "@/components/admin/SuccessStoriesManager";
import { DashSkeleton } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Success Stories" };

export default function SuccessStoriesPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireAdmin("/admin/success-stories");
  const { data, error } = await s.supabase
    .from("success_stories")
    .select("id,student_name,year,achievement,quote,photo_url,video_url,consent_at,is_published,sort_order,created_at")
    .order("sort_order")
    .order("created_at", { ascending: false });
  return <SuccessStoriesManager stories={(data ?? []) as AdminStory[]} setupMissing={!!error} />;
}
