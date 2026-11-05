import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CloseIcon } from "@/components/Icons";
import { getSession } from "@/lib/dashboard";
import { settleAttempt } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment Failed", robots: { index: false } };

// /payment-failed?back=/courses/xyz&reason=...
export default function PaymentFailedPage({ searchParams }: PageProps<"/payment-failed">) {
  return (
    <section className="hero-bg relative min-h-[70vh] overflow-hidden py-12 sm:py-16">
      <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
      <div className="container-page relative max-w-xl">
        <div className="card overflow-hidden text-center">
          <div className="bg-red-50 px-6 py-8 ring-1 ring-red-100 sm:px-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30"><CloseIcon className="h-8 w-8" /></span>
            <h1 className="mt-4 text-2xl font-extrabold text-brand-700 sm:text-3xl">Payment Failed</h1>
            <p className="mt-2 text-slate-600">Don&apos;t worry — nothing was charged, or if money was deducted, your bank refunds it automatically in 5–7 working days.</p>
          </div>
          <Suspense fallback={<Actions back="/courses" />}>
            <Details searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Details({ searchParams }: { searchParams: PageProps<"/payment-failed">["searchParams"] }) {
  const sp = await searchParams;
  const backRaw = typeof sp.back === "string" ? sp.back : "";
  const back = backRaw.startsWith("/") && !backRaw.startsWith("//") ? backRaw : "/courses";
  const reason = typeof sp.reason === "string" ? sp.reason.slice(0, 200) : "";

  // Record the failure ON THE SERVER (doesn't depend on the browser):
  // ask Razorpay about this order; if Razorpay says it failed → 'failed'
  // (now visible in Admin → Payments). If it was actually paid → 'paid'.
  const orderId = typeof sp.order === "string" && /^order_[A-Za-z0-9]{6,40}$/.test(sp.order) ? sp.order : null;
  if (orderId) {
    const session = await getSession();
    const db = getAdminSupabase();
    if (session && db) {
      const { data: p } = await db
        .from("purchases")
        .select("id,user_id,amount,status,razorpay_order_id,invoice_number")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();
      if (p && p.user_id === session.user.id && ["created", "pending"].includes(p.status)) {
        const res = await settleAttempt(db, p, { allowAbandon: false });
        if (res.status === "paid") redirect(`/payment-success?id=${p.id}`);
      }
    }
  }
  return <Actions back={back} reason={reason} />;
}

function Actions({ back, reason }: { back: string; reason?: string }) {
  return (
    <div className="p-6 sm:p-8">
      {reason && (
        <p className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <span className="font-semibold">Reason:</span> {reason}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={back} className="btn-primary flex-1 !py-3.5 text-base">Try Again</Link>
        <Link href="/contact#enquiry" className="btn-light flex-1 !py-3.5">Get Help</Link>
      </div>
      <p className="mt-4 text-xs text-slate-500">Tip: try UPI or a different card. Check your internet connection.</p>
    </div>
  );
}
