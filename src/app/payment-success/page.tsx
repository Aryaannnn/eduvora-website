import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CheckPaymentButton from "@/components/CheckPaymentButton";
import TrackEvent from "@/components/analytics/TrackEvent";
import DirectContact from "@/components/contact/DirectContact";
import { CheckIcon, ClockIcon, ReceiptIcon } from "@/components/Icons";
import { getContactAccess } from "@/lib/contact";
import { requireUser } from "@/lib/dashboard";
import { formatDateTime, formatPrice } from "@/lib/format";
import { creditsLine, getCredits } from "@/lib/packages";

export const metadata: Metadata = { title: "Payment Successful", robots: { index: false } };

type Order = {
  id: string; amount: number; status: "created" | "pending" | "paid" | "failed" | "abandoned"; invoice_number: string | null;
  razorpay_order_id: string | null; razorpay_payment_id: string | null; created_at: string; paid_at?: string | null;
  products: { title: string; category: string } | null;
};

// Students land here after Razorpay payment (or after unlocking a free item).
// /payment-success?id=<purchase id>
export default function PaymentSuccessPage({ searchParams }: PageProps<"/payment-success">) {
  return (
    <section className="hero-bg relative min-h-[70vh] overflow-hidden py-12 sm:py-16">
      <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
      <div className="container-page relative max-w-2xl">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/payment-success">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.id === "string" && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : null;
  const s = await requireUser(id ? `/payment-success?id=${id}` : "/payment-success");

  // RLS: a student can only read their OWN purchases
  const { data } = id
    ? await s.supabase
        .from("purchases")
        .select("id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,products(title,category)")
        .eq("id", id)
        .eq("user_id", s.user.id)
        .maybeSingle()
    : { data: null };
  const order = data as unknown as Order | null;
  const access = await getContactAccess();

  if (order?.status === "failed") {
    return (
      <div className="card p-6 text-center sm:p-10">
        <h1 className="text-2xl font-extrabold text-brand-700">This payment failed</h1>
        <p className="mt-2 text-slate-600">Razorpay reported that this payment did not go through. If money was deducted, your bank refunds it automatically in 5–7 working days.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/courses" className="btn-primary">Try again</Link>
          <Link href="/contact#enquiry" className="btn-light">Need help?</Link>
        </div>
      </div>
    );
  }

  if (order && order.status !== "paid") {
    return (
      <div className="card p-6 text-center sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-400 text-brand-950"><ClockIcon className="h-8 w-8" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-brand-700">We&apos;re confirming your payment</h1>
        <p className="mt-2 text-slate-600">If you completed the payment, tap the button below — we&apos;ll check with Razorpay and unlock your item straight away.</p>
        {order.razorpay_order_id && (
          <div className="mx-auto mt-6 max-w-sm">
            <CheckPaymentButton purchaseId={order.id} className="btn-accent w-full !py-3.5 text-base" />
          </div>
        )}
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard/payments" className="btn-light">See my payments</Link>
          <Link href="/contact#enquiry" className="btn-light">Need help?</Link>
        </div>
      </div>
    );
  }

  const free = order?.amount === 0;
  // Counselling package → show the session credits and "Book your first session"
  const isPackage = order?.products?.category === "counselling_package";
  const credits = isPackage ? await getCredits(s.supabase) : null;
  const rows: [string, string][] = order
    ? [
        ["Item", order.products?.title ?? "Your purchase"],
        ["Amount paid", free ? "Free" : formatPrice(order.amount)],
        ...(order.invoice_number ? ([["Invoice number", order.invoice_number]] as [string, string][]) : []),
        ...(order.razorpay_payment_id ? ([["Payment ID", order.razorpay_payment_id]] as [string, string][]) : []),
        ...(order.razorpay_order_id ? ([["Order ID", order.razorpay_order_id]] as [string, string][]) : []),
        ["Date", formatDateTime(order.created_at)],
      ]
    : [];

  return (
    <div className="space-y-6">
      {order && !free && <TrackEvent name="payment_success" onceKey={`pay-${order.id}`} props={{ value: order.amount, currency: "INR", item_type: order.products?.category ?? "item" }} />}
      <div className="card overflow-hidden">
        <div className="bg-emerald-50 px-6 py-8 text-center ring-1 ring-emerald-100 sm:px-10">
          <span className="mx-auto grid h-16 w-16 animate-fade-up place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><CheckIcon className="h-9 w-9" /></span>
          <h1 className="mt-4 text-2xl font-extrabold text-brand-700 sm:text-3xl">{free ? "Unlocked! 🎉" : "Payment Successful 🎉"}</h1>
          <p className="mt-2 text-slate-600">
            {isPackage
              ? `Your ${order?.products?.title} package is active. Book your sessions any time — no more payments needed.`
              : free ? "This free item is now in your dashboard." : "Thank you! Your item is unlocked and ready in your dashboard."}
          </p>
          {isPackage && credits && (
            <p className="mt-3 inline-flex rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-emerald-700 ring-1 ring-emerald-200">{creditsLine(credits)}</p>
          )}
        </div>

        {rows.length > 0 && (
          <div className="p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500"><ReceiptIcon className="h-4 w-4" /> Order details</p>
            <dl className="mt-4 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
              {rows.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-sm text-slate-500">{k}</dt>
                  <dd className="break-all text-sm font-semibold text-slate-900 sm:text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className={`flex flex-col gap-3 px-6 pb-8 sm:flex-row sm:px-8 ${rows.length ? "" : "pt-8"}`}>
          {isPackage ? (
            <Link href="/book-a-slot" className="btn-accent flex-1 !py-3.5 text-base">Book Your First Session</Link>
          ) : (
            <Link href="/dashboard/courses" className="btn-primary flex-1 !py-3.5 text-base">Go to Dashboard</Link>
          )}
          {!free && order?.invoice_number && (
            <a href={`/api/invoices/${order.id}`} download className="btn-light flex-1 !py-3.5">Download invoice (PDF)</a>
          )}
        </div>
      </div>

      {/* Paid students also unlock the founder's direct number */}
      {access.unlocked && !free && <DirectContact />}
    </div>
  );
}
