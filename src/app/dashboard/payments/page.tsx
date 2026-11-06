import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoiceButton } from "@/components/dashboard/Actions";
import { DashSkeleton, EmptyBox, PageHeader, StatusBadge } from "@/components/dashboard/ui";
import { getMyPurchases, requireUser } from "@/lib/dashboard";
import { formatDateTime, formatPrice } from "@/lib/format";
import { sweepStalePayments } from "@/lib/payments-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment History" };

export default function PaymentsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <PaymentsContent />
    </Suspense>
  );
}

async function PaymentsContent() {
  const s = await requireUser("/dashboard/payments");
  // Their own unfinished attempts > 30 min → ask Razorpay → paid / failed / hidden
  const db = getAdminSupabase();
  if (db) await sweepStalePayments(db, { userId: s.user.id, limit: 10 }).catch((e) => console.warn("[payments] cleanup failed:", e));
  // Only real outcomes: paid and failed. Unfinished attempts are never shown.
  const rows = (await getMyPurchases(s)).filter((r) => r.status === "paid" || r.status === "failed" || r.status === "refunded");
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <PageHeader title="Payment History" subtitle="All your purchases and their status.">
        {rows.length > 0 && (
          <p className="rounded-2xl bg-white px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
            Total paid: <strong className="text-slate-900">{formatPrice(totalPaid)}</strong>
          </p>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyBox text="No payments yet." href="/courses" cta="Browse courses" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Item</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDateTime(r.created_at)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{r.products?.title ?? "Item"}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{formatPrice(r.amount)}</td>
                    <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-4 text-right">
                      {r.status === "paid" ? (
                        <InvoiceButton purchaseId={r.id} invoiceNumber={r.invoice_number} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-slate-900">{r.products?.title ?? "Item"}</p>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{formatPrice(r.amount)}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(r.created_at)}</p>
                  </div>
                  {r.status === "paid" && <InvoiceButton purchaseId={r.id} invoiceNumber={r.invoice_number} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
