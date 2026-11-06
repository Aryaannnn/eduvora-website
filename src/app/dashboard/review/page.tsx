import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ReviewForm from "@/components/dashboard/ReviewForm";
import { DashSkeleton, PageHeader } from "@/components/dashboard/ui";
import { StarIcon } from "@/components/Icons";
import { requireUser } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { hasPaidAnything } from "@/lib/review-actions";

export const metadata: Metadata = { title: "Write a Review" };

export default function WriteReviewPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireUser("/dashboard/review");
  const paid = await hasPaidAnything();

  if (!paid) {
    return (
      <>
        <PageHeader title="Write a Review" subtitle="Share your experience with EDUVORA." />
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-400 text-brand-950"><StarIcon className="h-7 w-7" /></span>
          <p className="mt-4 text-lg font-bold text-slate-900">Reviews open after your first purchase or counselling session</p>
          <p className="mt-1 text-slate-600">So every review on our website comes from a real student or parent.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent">Book counselling</Link>
            <Link href="/courses" className="btn-light">Browse courses</Link>
          </div>
        </div>
      </>
    );
  }

  const { data: mine } = await s.supabase
    .from("reviews")
    .select("name,type,rating,comment,is_approved,updated_at")
    .eq("user_id", s.user.id)
    .maybeSingle();

  return (
    <>
      <PageHeader title={mine ? "Your Review" : "Write a Review"} subtitle="Tell other students and parents how EDUVORA helped you." />
      {mine && (
        <p className={`mb-4 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${mine.is_approved ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
          {mine.is_approved
            ? "✓ Your review is live on the website. Thank you! (If you edit it, it will be checked again before it shows.)"
            : `⏳ Waiting for approval — sent ${formatDateTime(mine.updated_at)}. It will appear on the website once approved.`}
        </p>
      )}
      <div className="card max-w-2xl p-5 sm:p-7">
        <ReviewForm
          initial={{
            name: (mine?.name as string) ?? s.profile?.full_name ?? "",
            type: ((mine?.type as "student" | "parent") ?? "student"),
            rating: (mine?.rating as number) ?? 0,
            comment: (mine?.comment as string) ?? "",
          }}
          editing={!!mine}
        />
      </div>
    </>
  );
}
