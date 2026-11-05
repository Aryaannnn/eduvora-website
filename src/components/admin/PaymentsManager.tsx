"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordPurchase, setPurchaseStatus } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime, formatPrice, todayInIndia } from "@/lib/format";
import { DownloadIcon, PlusIcon, SearchIcon } from "../Icons";
import CheckPaymentButton from "../CheckPaymentButton";
import { AdminHeader, Label, Modal, Notice, downloadCsv } from "./ui";

export type AdminPayment = {
  id: string; user_id: string; amount: number; status: "created" | "pending" | "paid" | "failed" | "abandoned"; invoice_number: string | null;
  razorpay_order_id: string | null; razorpay_payment_id: string | null; created_at: string; product: string; student: string; email: string;
  failure_reason?: string | null;
};

// Only real outcomes are listed. Unfinished attempts ('created' / 'abandoned') stay hidden
// and appear only under "Show unfinished attempts" at the bottom (for support cases).
const STATUSES = ["paid", "failed"] as const;
const color: Record<string, string> = { paid: "bg-green-50 text-green-700", failed: "bg-red-50 text-red-700" };
const dayIST = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

export default function PaymentsManager({
  payments,
  attempts,
  users,
  products,
}: {
  payments: AdminPayment[];
  attempts: AdminPayment[];
  users: { id: string; label: string }[];
  products: { id: string; title: string; price: number }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"all" | (typeof STATUSES)[number]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = payments.filter((p) => {
    const d = dayIST(p.created_at);
    return (
      (status === "all" || p.status === status) &&
      (!from || d >= from) &&
      (!to || d <= to) &&
      (!q || `${p.student} ${p.email} ${p.product} ${p.invoice_number ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    );
  });
  const totalPaid = shown.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) { after?.(); router.refresh(); }
    });

  const exportCsv = () =>
    downloadCsv(
      `payments-${todayInIndia()}.csv`,
      ["Date", "Student", "Email", "Item", "Amount (INR)", "Status", "Invoice", "Razorpay order", "Razorpay payment"],
      shown.map((p) => [csvDateTimeIST(p.created_at), p.student, p.email, p.product, p.amount, p.status, p.invoice_number, p.razorpay_order_id, p.razorpay_payment_id]),
    );

  return (
    <>
      <AdminHeader title="Payments" subtitle="Every purchase. Paid purchases unlock content for the student.">
        <button type="button" onClick={exportCsv} className="btn-light"><DownloadIcon /> Export CSV</button>
        <button type="button" onClick={() => setAdding(true)} className="btn-primary"><PlusIcon /> Record payment</button>
      </AdminHeader>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, item, invoice…" className="input !pl-9" aria-label="Search payments" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input" aria-label="Filter by status">
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
      </div>

      <p className="mb-3 text-sm text-slate-600">{shown.length} payment(s) · Paid total: <strong className="text-slate-900">{formatPrice(totalPaid).replace("Free", "₹0")}</strong></p>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`card overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Invoice / Source</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No payments match.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(p.created_at)}</td>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{p.student}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                <td className="px-4 py-3 text-slate-700">{p.product}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatPrice(p.amount)}</td>
                <td className="px-4 py-3">
                  <select value={p.status} onChange={(e) => confirm(`Change this payment to "${e.target.value}"? Paid = student gets access.`) && run(() => setPurchaseStatus(p.id, e.target.value as "paid" | "failed"))}
                    className={`rounded-xl border-0 px-3 py-1.5 text-xs font-bold capitalize ring-1 ring-slate-200 ${color[p.status]}`} aria-label="Payment status">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {p.status === "failed" && p.failure_reason && <p className="mt-1 max-w-[14rem] text-[11px] text-red-600">{p.failure_reason}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {p.status === "paid" && p.invoice_number ? (
                    <span>
                      <a href={`/invoice/${p.id}`} className="font-semibold text-brand-700 underline">{p.invoice_number}</a>
                      {" · "}
                      <a href={`/api/invoices/${p.id}`} download className="font-semibold text-brand-700 underline">PDF</a>
                    </span>
                  ) : (
                    <p className="font-semibold text-slate-700">{p.invoice_number ?? "—"}</p>
                  )}
                  {p.razorpay_order_id ? (
                    <>
                      <p className="mt-0.5" title={`Order ${p.razorpay_order_id}`}>Razorpay{p.razorpay_payment_id ? ` · ${p.razorpay_payment_id}` : ""}</p>
                      {p.status !== "paid" && (
                        <div className="mt-1.5"><CheckPaymentButton purchaseId={p.id} className="btn-light !px-2.5 !py-1 text-[11px]" label="Check with Razorpay" /></div>
                      )}
                    </>
                  ) : (
                    <p className="mt-0.5">{p.amount === 0 ? "Free item" : "Manual"}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UnfinishedAttempts attempts={attempts} />

      {adding && <RecordPaymentForm users={users} products={products} pending={pending} onClose={() => setAdding(false)} onSubmit={(v) => run(() => recordPurchase(v), () => setAdding(false))} />}
    </>
  );
}

function RecordPaymentForm({ users, products, pending, onClose, onSubmit }: {
  users: { id: string; label: string }[]; products: { id: string; title: string; price: number }[]; pending: boolean; onClose: () => void;
  onSubmit: (v: { user_id: string; product_id: string; amount: string; status: "paid" | "failed" }) => void;
}) {
  const [v, setV] = useState({ user_id: "", product_id: "", amount: "", status: "paid" as "paid" | "failed" });
  return (
    <Modal title="Record a payment" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="space-y-4">
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">Online payments through Razorpay are recorded automatically. Use this only when a student pays you directly (UPI / bank transfer / cash). <strong>Paid</strong> unlocks the item in their dashboard.</p>
        <div>
          <Label htmlFor="rp-user">Student *</Label>
          <select id="rp-user" value={v.user_id} onChange={(e) => setV({ ...v, user_id: e.target.value })} className="input" required>
            <option value="">Choose a student…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="rp-prod">Product *</Label>
          <select id="rp-prod" value={v.product_id} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); setV({ ...v, product_id: e.target.value, amount: p ? String(p.price) : v.amount }); }} className="input" required>
            <option value="">Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title} — {formatPrice(p.price)}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="rp-amount">Amount (₹) *</Label><input id="rp-amount" type="number" min={0} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="input" required /></div>
          <div>
            <Label htmlFor="rp-status">Status</Label>
            <select id="rp-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as typeof v.status })} className="input">
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save payment</button>
        </div>
      </form>
    </Modal>
  );
}

/** Support only: hidden attempts (popup opened but no payment recorded). Closed by default. */
function UnfinishedAttempts({ attempts }: { attempts: AdminPayment[] }) {
  return (
    <details className="group mt-8 text-sm">
      <summary className="cursor-pointer select-none text-xs font-semibold text-slate-500 hover:text-slate-800">
        Show unfinished attempts ({attempts.length})
      </summary>
      <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <p className="mb-3 text-xs text-slate-500">
          A student opened the Razorpay popup but no payment was recorded (closed it, or it is still being checked). These are NOT counted anywhere.
          If a student says they paid but did not get access, find them here and click <strong>Check with Razorpay</strong> — if Razorpay has the money,
          it becomes Paid and the item unlocks. Attempts older than 30 minutes are checked automatically.
        </p>
        {attempts.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">No unfinished attempts.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-slate-900">{a.student} <span className="font-normal text-slate-500">· {a.email}</span></p>
                  <p className="text-slate-600">{a.product} · {formatPrice(a.amount)}</p>
                  <p className="text-slate-400">
                    {formatDateTime(a.created_at)} · {a.status === "abandoned" ? "Abandoned (not paid)" : "Not finished yet"} · {a.razorpay_order_id}
                  </p>
                </div>
                <CheckPaymentButton purchaseId={a.id} className="btn-light !px-2.5 !py-1 text-[11px]" label="Check with Razorpay" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
