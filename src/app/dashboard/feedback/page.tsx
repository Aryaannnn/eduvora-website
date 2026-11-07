import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FeedbackForm, { type MyFeedback } from "@/components/dashboard/FeedbackForm";
import { DashSkeleton, PageHeader } from "@/components/dashboard/ui";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/dashboard";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Session Feedback", robots: { index: false } };

// /dashboard/feedback?booking=<id>[&rating=1-5] — the link in the feedback email
export default function FeedbackPage({ searchParams }: PageProps<"/dashboard/feedback">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/dashboard/feedback">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.booking === "string" && /^[0-9a-f-]{36}$/i.test(sp.booking) ? sp.booking : "";
  const startRating = Number(typeof sp.rating === "string" ? sp.rating : 0);
  const s = await requireUser(`/dashboard/feedback?booking=${id}${startRating ? `&rating=${startRating}` : ""}`);

  // RLS: students only see their own bookings and feedback
  const [{ data: b }, { data: fb }] = await Promise.all([
    s.supabase.from("bookings").select("id,status,slots(date,start_time,end_time)").eq("id", id).eq("user_id", s.user.id).maybeSingle(),
    s.supabase.from("session_feedback").select("rating,helped_most,improve,allow_public").eq("booking_id", id).maybeSingle(),
  ]);
  const booking = b as unknown as { id: string; status: string; slots: { date: string; start_time: string; end_time: string } | null } | null;

  const back = <Link href="/dashboard/bookings" className="btn-light">My Bookings</Link>;
  if (!booking) {
    return (
      <>
        <PageHeader title="Session feedback">{back}</PageHeader>
        <p className="card p-8 text-center text-slate-600">We couldn&apos;t find this session in your account. Make sure you are logged in with the account you booked with.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="How was your session?"
        subtitle={booking.slots ? `Counselling with ${siteConfig.founder.name} · ${formatDate(booking.slots.date, true)}, ${formatTime(booking.slots.start_time)} IST` : undefined}
      >
        {back}
      </PageHeader>
      <div className="card max-w-2xl p-5 sm:p-7">
        {booking.status === "completed" ? (
          <>
            {fb && <p className="mb-4 rounded-xl bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">You already sent feedback for this session — you can update it below.</p>}
            <FeedbackForm bookingId={booking.id} initial={fb as MyFeedback | null} startRating={startRating} />
          </>
        ) : booking.status === "cancelled" ? (
          <p className="text-slate-600">This session was cancelled, so there is nothing to rate.</p>
        ) : (
          <p className="text-slate-600">You can give feedback once your session is over. See you there!</p>
        )}
      </div>
    </>
  );
}
