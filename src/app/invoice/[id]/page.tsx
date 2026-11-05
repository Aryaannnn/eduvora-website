import type { Metadata } from "next";
import { Suspense } from "react";
import BackButton from "@/components/BackButton";
import { DashSkeleton } from "@/components/dashboard/ui";
import PrintButton from "@/components/dashboard/PrintButton";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/dashboard";
import { formatDate, formatDateTime, formatPrice, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

type Row = {
  id: string; user_id: string; amount: number; status: string; invoice_number: string | null; razorpay_order_id: string | null;
  razorpay_payment_id: string | null; created_at: string; paid_at?: string | null; products: { title: string; category: string } | null;
};

// Printable invoice. All dates and times are in Indian Standard Time (IST).
// Students see only their own invoices (Row Level Security); admins see all.
export default function InvoicePage(props: PageProps<"/invoice/[id]">) {
  return (
    <section className="min-h-[60vh] bg-slate-50 py-8 sm:py-12 print:bg-white print:py-0">
      <div className="container-page">
        <Suspense fallback={<div className="mx-auto max-w-2xl"><DashSkeleton /></div>}>
          {props.params.then(({ id }) => <Invoice id={id} />)}
        </Suspense>
      </div>
    </section>
  );
}

async function Invoice({ id }: { id: string }) {
  const s = await requireUser(`/invoice/${id}`);
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const { data } = valid
    ? await s.supabase
        .from("purchases")
        .select("id,user_id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,products(title,category)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  let p = data as unknown as Row | null;

  // Not a product purchase? It may be a paid counselling booking.
  if (!p && valid) {
    const { data: bk } = await s.supabase
      .from("bookings")
      .select("id,user_id,amount,payment_status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,slots(date,start_time,end_time)")
      .eq("id", id)
      .maybeSingle();
    const b = bk as unknown as (Omit<Row, "status" | "products"> & { payment_status: string; slots: { date: string; start_time: string; end_time: string } | null }) | null;
    if (b) {
      p = {
        ...b,
        status: b.payment_status,
        products: {
          title: `One-to-one counselling session${b.slots ? ` — ${formatDate(b.slots.date, true)}, ${formatTime(b.slots.start_time)}–${formatTime(b.slots.end_time)} IST` : ""}`,
          category: "counselling",
        },
      };
    }
  }

  if (!p || p.status !== "paid") {
    return <p className="card mx-auto max-w-2xl p-8 text-center text-slate-600">Invoice not available. Invoices are created once a payment is confirmed.</p>;
  }

  // Buyer details (their own profile; admins can read any)
  const { data: buyer } = await s.supabase.from("profiles").select("full_name,email,phone").eq("id", p.user_id).maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <BackButton />
        <span className="flex gap-2">
          <a href={`/api/invoices/${p.id}`} download className="btn-accent !px-4 !py-2.5 text-sm">Download PDF</a>
          <PrintButton label="Print" />
        </span>
      </div>
      <article className="card p-6 sm:p-10 print:shadow-none print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-2xl font-extrabold text-brand-700">{siteConfig.billingName}</p>
            {siteConfig.showAddress && <p className="mt-1 max-w-xs text-sm text-slate-500">{siteConfig.invoice.address}</p>}
            <p className={`${siteConfig.showAddress ? "" : "mt-1 "}text-sm text-slate-500`}>{siteConfig.email}</p>
            {siteConfig.invoice.gstin.trim() && <p className="text-sm text-slate-500">GSTIN: {siteConfig.invoice.gstin.trim()}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Invoice</p>
            <p className="text-lg font-extrabold text-slate-900">{p.invoice_number ?? "—"}</p>
            <p className="mt-1 text-sm text-slate-600">Date: {formatDateTime(p.paid_at ?? p.created_at)}</p>
          </div>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Billed to</p>
            <p className="mt-1 font-semibold text-slate-900">{buyer?.full_name || "Student"}</p>
            {buyer?.email && <p className="text-sm text-slate-600">{buyer.email}</p>}
            {buyer?.phone && <p className="text-sm text-slate-600">+{String(buyer.phone).replace(/^\+/, "")}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment</p>
            <p className="mt-1 text-sm text-slate-600">{p.amount === 0 ? "Free item" : p.razorpay_payment_id ? "Online (Razorpay)" : "Recorded by EDUVORA"}</p>
            {p.razorpay_payment_id && <p className="break-all text-xs text-slate-500">Payment ID: {p.razorpay_payment_id}</p>}
            {p.razorpay_order_id && <p className="break-all text-xs text-slate-500">Order ID: {p.razorpay_order_id}</p>}
            <p className="text-xs text-slate-500">Ordered: {formatDateTime(p.created_at)}</p>
          </div>
        </section>

        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-3 font-semibold text-slate-900">{p.products?.title ?? "Purchase"}</td>
              <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatPrice(p.amount).replace("Free", "₹0")}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td className="px-3 py-3 text-right font-bold text-slate-700">Total paid</td><td className="px-3 py-3 text-right text-lg font-extrabold text-brand-700">{formatPrice(p.amount).replace("Free", "₹0")}</td></tr>
          </tfoot>
        </table>

        <p className="mt-8 text-xs text-slate-500">All dates and times are in Indian Standard Time (IST, UTC+5:30). This is a computer-generated invoice.</p>
      </article>
    </div>
  );
}
