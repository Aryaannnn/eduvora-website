import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CancelBookingButton } from "@/components/dashboard/Actions";
import FeedbackForm, { type MyFeedback } from "@/components/dashboard/FeedbackForm";
import { DashSkeleton, EmptyBox, PageHeader, StatusBadge } from "@/components/dashboard/ui";
import SessionCreditsCard from "@/components/packages/SessionCreditsCard";
import { CalendarIcon, ClockIcon, VideoIcon } from "@/components/Icons";
import { getMyBookings, requireUser } from "@/lib/dashboard";
import { formatDate, formatDateTime, formatPrice, formatTime, todayInIndia } from "@/lib/format";
import { getCredits } from "@/lib/packages";

export const metadata: Metadata = { title: "My Bookings" };

export default function BookingsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <BookingsContent />
    </Suspense>
  );
}

async function BookingsContent() {
  const s = await requireUser("/dashboard/bookings");
  const [bookings, credits, fbRes] = await Promise.all([
    getMyBookings(s),
    getCredits(s.supabase),
    s.supabase.from("session_feedback").select("booking_id,rating,helped_most,improve,allow_public").eq("user_id", s.user.id), // empty before feedback.sql
  ]);
  const feedback = new Map(((fbRes.data ?? []) as (MyFeedback & { booking_id: string })[]).map((f) => [f.booking_id, f]));
  const today = todayInIndia();

  return (
    <>
      <PageHeader title="My Bookings" subtitle="Your one-to-one counselling calls.">
        <Link href="/book-a-slot" className="btn-primary">Book a new slot</Link>
      </PageHeader>
      <div className="mb-6"><SessionCreditsCard credits={credits} /></div>

      {bookings.length === 0 ? (
        <EmptyBox text="You haven't booked a counselling call yet." href="/book-a-slot" cta="Book your first slot" />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const upcoming = !!b.slots && b.slots.date >= today && ["pending", "confirmed"].includes(b.status);
            const fb = feedback.get(b.id);
            return (
              <li key={b.id} className="card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-center ${upcoming ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <CalendarIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{b.slots ? formatDate(b.slots.date, true) : "Slot removed"}</p>
                    {b.slots && (
                      <p className="flex items-center gap-1.5 text-sm text-slate-600">
                        <ClockIcon className="h-4 w-4" /> {formatTime(b.slots.start_time)} – {formatTime(b.slots.end_time)} IST · {b.payment_status === "paid" && b.amount === 0 && !b.invoice_number ? "Package credit" : formatPrice(b.amount ?? b.slots.price)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">Booked on {formatDateTime(b.created_at)} · Payment: {b.payment_status}</p>
                    {upcoming && b.status === "confirmed" && (
                      b.meet_link ? (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3 !bg-emerald-600 !px-4 !py-2 text-sm hover:!bg-emerald-700">
                          <VideoIcon className="h-4 w-4" /> Join Google Meet
                        </a>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                          <VideoIcon className="h-3.5 w-3.5" /> Meet link will be shared soon
                        </p>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                  <StatusBadge status={b.status} />
                  {b.invoice_number && (
                    <span className="text-xs">
                      <Link href={`/invoice/${b.id}`} className="font-semibold text-brand-700 underline">Invoice {b.invoice_number}</Link>
                      {" · "}
                      <a href={`/api/invoices/${b.id}`} download className="font-semibold text-brand-700 underline">PDF</a>
                    </span>
                  )}
                  {upcoming && <CancelBookingButton bookingId={b.id} />}
                </div>
              </div>
              {b.status === "completed" && !fbRes.error && (
                <details className="group mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200" open={!fb}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-800">
                    {fb ? (
                      <span>
                        Your feedback: <span className="text-amber-500" aria-label={`${fb.rating} out of 5 stars`}>{"★".repeat(fb.rating)}<span className="text-slate-300">{"★".repeat(5 - fb.rating)}</span></span> · Thank you!
                      </span>
                    ) : (
                      <span>⭐ How was your session? Give feedback (1 minute)</span>
                    )}
                    <span className="text-xs font-semibold text-brand-700 group-open:hidden">{fb ? "Edit" : "Open"}</span>
                  </summary>
                  <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                    <FeedbackForm bookingId={b.id} initial={fb ?? null} />
                  </div>
                </details>
              )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-sm text-slate-500">
        Need to reschedule? Message us on WhatsApp from the <Link href="/dashboard/help" className="font-semibold text-brand-700 underline">Help</Link> page. See our{" "}
        <Link href="/refund-policy" className="font-semibold text-brand-700 underline">Refund &amp; Cancellation Policy</Link>.
      </p>
    </>
  );
}
