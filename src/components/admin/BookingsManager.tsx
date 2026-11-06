"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rescheduleBooking, updateBooking } from "@/app/admin/actions";
import { formatDate, formatDateTime, formatPrice, formatTime } from "@/lib/format";
import { MailIcon, PhoneIcon, SearchIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader, Notice } from "./ui";

export type FreeSlot = { id: string; date: string; start_time: string; end_time: string };

export type AdminBooking = {
  id: string; name: string; phone: string; email: string | null; message: string | null;
  class_year?: string | null; expected_marks?: number | null; amount?: number | null; invoice_number?: string | null; paid_at?: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed"; payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"; created_at: string;
  slots: { date: string; start_time: string; end_time: string; price: number } | null;
};

const STATUS = ["pending", "confirmed", "completed", "cancelled"] as const;
const PAYMENT = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
const statusColor: Record<string, string> = { pending: "bg-amber-50 text-amber-800", confirmed: "bg-green-50 text-green-700", completed: "bg-slate-100 text-slate-700", cancelled: "bg-red-50 text-red-700" };

// Turns "9876543210" / "+91 98765 43210" into "919876543210"
const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function BookingsManager({ bookings, today, freeSlots = [] }: { bookings: AdminBooking[]; today: string; freeSlots?: FreeSlot[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"upcoming" | "all" | (typeof STATUS)[number]>("upcoming");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = bookings.filter((b) => {
    const matchesFilter =
      filter === "all" ? true : filter === "upcoming" ? !!b.slots && b.slots.date >= today && ["pending", "confirmed"].includes(b.status) : b.status === filter;
    const text = `${b.name} ${b.phone} ${b.email ?? ""}`.toLowerCase();
    return matchesFilter && (!q || text.includes(q.toLowerCase()));
  });

  const reschedule = (b: AdminBooking, slotId: string) => {
    const slot = freeSlots.find((x) => x.id === slotId);
    if (!slot || !confirm(`Move ${b.name}'s session to ${formatDate(slot.date, true)} at ${formatTime(slot.start_time)}? They will get an email with the new time.`)) return;
    start(async () => {
      const res = await rescheduleBooking(b.id, slotId);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Moved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  const change = (id: string, patch: Parameters<typeof updateBooking>[1]) =>
    start(async () => {
      const res = await updateBooking(id, patch);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  return (
    <>
      <AdminHeader title="Bookings" subtitle="Counselling calls booked by students." />
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email…" className="input !pl-9" aria-label="Search bookings" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input sm:!w-52" aria-label="Filter bookings">
          <option value="upcoming">Upcoming (pending + confirmed)</option>
          <option value="all">All bookings</option>
          {STATUS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No bookings here.</p>
      ) : (
        <ul className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
          {shown.map((b) => {
            const phone = intlPhone(b.phone);
            const wa = `https://wa.me/${phone}?text=${encodeURIComponent(
              `Hi ${b.name}, this is about your counselling call${b.slots ? ` on ${formatDate(b.slots.date)} at ${formatTime(b.slots.start_time)}` : ""}.`,
            )}`;
            return (
              <li key={b.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-extrabold text-slate-900">{b.name}</p>
                    <p className="text-sm text-slate-600">
                      {b.slots ? <><strong>{formatDate(b.slots.date, true)}</strong> · {formatTime(b.slots.start_time)} – {formatTime(b.slots.end_time)} · {formatPrice(b.slots.price)}</> : "Slot removed"}
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1"><PhoneIcon className="h-3.5 w-3.5" /> {b.phone}</span>
                      {b.email && <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 hover:text-brand-700"><MailIcon className="h-3.5 w-3.5" /> {b.email}</a>}
                    </p>
                    {(b.class_year || b.expected_marks !== null && b.expected_marks !== undefined) && (
                      <p className="flex flex-wrap gap-2 text-xs">
                        {b.class_year && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">{b.class_year}</span>}
                        {b.expected_marks !== null && b.expected_marks !== undefined && (
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700">Expected marks: {+b.expected_marks}/125</span>
                        )}
                      </p>
                    )}
                    {b.message && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">“{b.message}”</p>}
                    {b.payment_status === "paid" && (
                      <p className="text-xs text-emerald-700">
                        {b.amount === 0 && !b.invoice_number ? "Paid with a package session credit" : `Paid ${formatPrice(b.amount ?? b.slots?.price ?? 0)}`}{b.paid_at ? ` · ${formatDateTime(b.paid_at)}` : ""}
                        {b.invoice_number && <> · <a href={`/invoice/${b.id}`} className="font-semibold underline">{b.invoice_number}</a> · <a href={`/api/invoices/${b.id}`} download className="font-semibold underline">PDF</a></>}
                        {b.status === "pending" && <strong className="ml-1 text-amber-700">· Paid late — time was taken: reschedule or refund</strong>}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">Booked {formatDateTime(b.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                    <div className="flex gap-2">
                      <a href={`tel:+${phone}`} className="btn-primary !px-4 !py-2 text-sm"><PhoneIcon className="h-4 w-4" /> Call</a>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !px-4 !py-2 text-sm"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
                    </div>
                    <div className="flex gap-2">
                      <select value={b.status} onChange={(e) => change(b.id, { status: e.target.value as AdminBooking["status"] })} className={`rounded-xl border-0 px-3 py-2 text-sm font-bold capitalize ring-1 ring-slate-200 ${statusColor[b.status]}`} aria-label="Booking status">
                        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={b.payment_status} onChange={(e) => change(b.id, { payment_status: e.target.value as AdminBooking["payment_status"] })} className="rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold capitalize text-slate-700 ring-1 ring-slate-200" aria-label="Payment status">
                        {PAYMENT.map((s) => <option key={s} value={s}>Payment: {s}</option>)}
                      </select>
                    </div>
                    {["pending", "confirmed"].includes(b.status) && freeSlots.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && reschedule(b, e.target.value)}
                        className="rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                        aria-label={`Reschedule ${b.name}`}
                      >
                        <option value="">Reschedule to…</option>
                        {freeSlots.map((x) => (
                          <option key={x.id} value={x.id}>{formatDate(x.date)} · {formatTime(x.start_time)}–{formatTime(x.end_time)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Setting a booking to <strong>cancelled</strong> opens the slot again for other students.</p>
    </>
  );
}
