import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import BookingCheckButton from "@/components/BookingCheckButton";
import Confetti from "@/components/Confetti";
import DirectContact from "@/components/contact/DirectContact";
import { CalendarIcon, CheckIcon, ClockIcon, ReceiptIcon, TargetIcon } from "@/components/Icons";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/dashboard";
import { formatDate, formatDateTime, formatPrice, formatTime } from "@/lib/format";
import { getPredictorAccess } from "@/lib/predictor-server";

export const metadata: Metadata = { title: "Booking Confirmed", robots: { index: false } };

type Booking = {
  id: string; name: string; status: string; payment_status: string; amount: number | null; invoice_number: string | null;
  razorpay_payment_id: string | null; paid_at: string | null; created_at: string;
  slots: { date: string; start_time: string; end_time: string; price: number } | null;
};

const founderFirst = siteConfig.founder.name.split(" ")[0];

// "10:00:00" → minutes since midnight
const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// "2026-11-10" + "10:00:00" → "20261110T100000" (Google Calendar, India time)
const gcalTime = (d: string, t: string) => `${d.replace(/-/g, "")}T${t.slice(0, 8).replace(/:/g, "")}`;

// /booking-confirmed?id=<booking id> — shown ONLY after a verified payment
export default function BookingConfirmedPage({ searchParams }: PageProps<"/booking-confirmed">) {
  return (
    <section className="hero-bg relative min-h-[80vh] overflow-hidden py-10 sm:py-16">
      <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
      <div className="container-page relative max-w-2xl">
        <Suspense fallback={<div className="card h-[28rem] animate-pulse" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/booking-confirmed">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : "";
  const s = await requireUser(`/booking-confirmed?id=${id}`);
  // RLS: students can only read their own bookings
  const { data } = await s.supabase
    .from("bookings")
    .select("id,name,status,payment_status,amount,invoice_number,razorpay_payment_id,paid_at,created_at,slots(date,start_time,end_time,price)")
    .eq("id", id)
    .eq("user_id", s.user.id)
    .maybeSingle();
  const b = data as unknown as Booking | null;

  if (!b) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-bold text-slate-900">Booking not found</p>
        <Link href="/book-a-slot" className="btn-primary mt-5">Book a slot</Link>
      </div>
    );
  }

  const isFree = (b.amount ?? b.slots?.price ?? 0) === 0;
  const booked = b.payment_status === "paid" || (isFree && b.status === "confirmed");

  // ---------- not paid (yet) ----------
  if (!booked) {
    const stillOpen = b.status === "awaiting_payment";
    return (
      <div className="card p-6 text-center sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-400 text-brand-950"><ClockIcon className="h-8 w-8" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-brand-700">{stillOpen ? "Checking your payment…" : "Payment not completed"}</h1>
        <p className="mt-2 text-slate-600">
          {stillOpen
            ? "If you completed the payment, we'll confirm it with Razorpay in a moment."
            : "Your slot was not booked. Please try again — it only takes a minute."}
        </p>
        <div className="mx-auto mt-6 max-w-sm space-y-3">
          {stillOpen && <BookingCheckButton bookingId={b.id} auto />}
          <Link href="/book-a-slot" className={stillOpen ? "btn-light w-full" : "btn-primary w-full"}>Try booking again</Link>
        </div>
      </div>
    );
  }

  // ---------- 🎉 booked ----------
  const access = await getPredictorAccess();
  const slot = b.slots;
  const duration = slot ? mins(slot.end_time) - mins(slot.start_time) : 0;
  const firstName = b.name.split(" ")[0] || "there";
  const gcal = slot
    ? `https://calendar.google.com/calendar/render?${new URLSearchParams({
        action: "TEMPLATE",
        text: `EDUVORA counselling with ${siteConfig.founder.name}`,
        dates: `${gcalTime(slot.date, slot.start_time)}/${gcalTime(slot.date, slot.end_time)}`,
        ctz: "Asia/Kolkata",
        details: `One-to-one VITEEE counselling session.\nBooking ID: ${b.id.slice(0, 8).toUpperCase()}${b.invoice_number ? `\nInvoice: ${b.invoice_number}` : ""}\n${siteConfig.siteUrl}/dashboard/bookings`,
      }).toString()}`
    : null;
  const paidLater = b.status === "pending"; // paid after the hold ran out and someone else took the time

  const rows: [string, string][] = [
    ["Date", slot ? formatDate(slot.date, true) : "—"],
    ["Time", slot ? `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)} IST` : "—"],
    ["Duration", duration > 0 ? `${duration} minutes` : "—"],
    ["Amount paid", isFree ? "Free" : formatPrice(b.amount ?? slot?.price ?? 0)],
    ["Booking ID", b.id.slice(0, 8).toUpperCase()],
    ["Invoice number", b.invoice_number ?? (isFree ? "— (free session)" : "Being generated…")],
    ...(b.paid_at ? ([["Paid on", formatDateTime(b.paid_at)]] as [string, string][]) : []),
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-brand-950/30 ring-4 ring-accent-400/70">
        <Confetti />
        {/* header */}
        <div className="relative bg-gradient-to-b from-emerald-50 to-white px-6 pb-6 pt-10 text-center sm:px-10">
          <span className="animate-pop-in mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 ring-8 ring-emerald-100">
            <CheckIcon className="h-14 w-14" />
          </span>
          <h1 className="mt-6 text-2xl font-extrabold leading-tight text-brand-700 sm:text-3xl">
            Congratulations, {firstName}! 🎉
            <span className="mt-1 block text-lg font-bold text-slate-700 sm:text-xl">Your counselling session is booked.</span>
          </h1>
          {paidLater && (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              Your payment arrived after this time slot was taken. Don&apos;t worry — our team will call you to pick a new time (or refund you).
            </p>
          )}
        </div>

        {/* details */}
        <dl className="relative mx-5 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200 sm:mx-8">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-slate-500">{k}</dt>
              <dd className="break-all text-right text-sm font-bold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>

        {b.invoice_number && (
          <p className="relative -mb-3 mt-4 text-center text-xs text-slate-500">
            <a href={`/api/invoices/${b.id}`} download className="font-semibold text-brand-700 underline">Download invoice PDF</a> · a copy is also in your email
          </p>
        )}
        {/* actions */}
        <div className="relative grid gap-3 p-5 sm:grid-cols-3 sm:p-8">
          {gcal && (
            <a href={gcal} target="_blank" rel="noopener noreferrer" className="btn-accent !py-3 text-sm">
              <CalendarIcon className="h-4 w-4" /> Add to Google Calendar
            </a>
          )}
          {b.invoice_number && (
            <Link href={`/invoice/${b.id}`} className="btn-light !py-3 text-sm"><ReceiptIcon className="h-4 w-4" /> View Invoice</Link>
          )}
          <Link href="/dashboard/bookings" className="btn-primary !py-3 text-sm">Go to My Bookings</Link>
        </div>
      </div>

      {access.allowed && (
        <div className="overflow-hidden rounded-3xl bg-brand-700 p-6 text-center text-white shadow-xl shadow-brand-900/30 ring-4 ring-accent-400/60 sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-400 text-brand-950"><TargetIcon className="h-7 w-7" /></span>
          <h2 className="mt-4 text-xl font-extrabold sm:text-2xl">Your Rank &amp; College Predictor is now unlocked!</h2>
          <p className="mt-2 text-slate-300">See your predicted rank, the VIT campus and branch you can get, and your chances — before you talk to {founderFirst} Sir.</p>
          <Link href="/dashboard/predictor" className="btn-accent mt-5 !px-7 !py-3.5 text-base">Try Predictor</Link>
        </div>
      )}

      {/* Utkarsh Sir's full number (only for paid students — checked on the server) */}
      <DirectContact />
    </div>
  );
}
