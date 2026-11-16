"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignBooking, rescheduleBooking, retryBookingCalendar, updateBooking } from "@/app/admin/actions";
import { CallButton, CallStatusPill, CallStatusRow, TodaysCalls, type CallStatus } from "./CallTools";
import BookingNotes, { type BookingNote } from "./BookingNotes";
import { formatDate, formatDateTime, formatPrice, formatTime } from "@/lib/format";
import { MailIcon, SearchIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader, Notice } from "./ui";

export type FreeSlot = { id: string; date: string; start_time: string; end_time: string };

export type AdminBooking = {
  id: string; name: string; phone: string; email: string | null; message: string | null;
  class_year?: string | null; expected_marks?: number | null; amount?: number | null; invoice_number?: string | null; paid_at?: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed"; payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded"; created_at: string;
  slots: { date: string; start_time: string; end_time: string; price: number } | null;
  calendar_status?: string | null; calendar_error?: string | null; assigned_to?: string | null;
  call_status?: CallStatus | null; call_note?: string | null;
};
export type StaffMember = { id: string; full_name: string | null; email: string | null; role: string };

const STATUS = ["pending", "confirmed", "completed", "cancelled"] as const;
const PAYMENT = ["unpaid", "pending", "paid", "failed", "refunded"] as const;
const statusColor: Record<string, string> = { pending: "bg-amber-50 text-amber-800", confirmed: "bg-green-50 text-green-700", completed: "bg-slate-100 text-slate-700", cancelled: "bg-red-50 text-red-700" };

// Turns "9876543210" / "+91 98765 43210" into "919876543210"
const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function BookingsManager({
  bookings, today, freeSlots = [], callReady = true, staff = null, staffNames = {}, notes = {}, me = "",
}: {
  bookings: AdminBooking[]; today: string; freeSlots?: FreeSlot[];
  /** false until supabase/voice-calls.sql is run (no call status / note yet) */
  callReady?: boolean;
  /** admins + counsellors for "Assigned to" (null before supabase/counsellor.sql) */
  staff?: StaffMember[] | null; staffNames?: Record<string, string>; notes?: Record<string, BookingNote[]>; me?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"upcoming" | "all" | (typeof STATUS)[number]>("upcoming");
  const [q, setQ] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = bookings.filter((b) => {
    const matchesFilter =
      filter === "all" ? true : filter === "upcoming" ? !!b.slots && b.slots.date >= today && ["pending", "confirmed"].includes(b.status) : b.status === filter;
    const text = `${b.name} ${b.phone} ${b.email ?? ""}`.toLowerCase();
    const matchesAssigned = assignedFilter === "all" ? true : assignedFilter === "none" ? !b.assigned_to : b.assigned_to === assignedFilter;
    return matchesFilter && matchesAssigned && (!q || text.includes(q.toLowerCase()));
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

  const isUpcoming = (b: AdminBooking) => !!b.slots && b.slots.date >= today && b.status === "confirmed";
  const todaysCalls = bookings
    .filter((b) => b.slots?.date === today && ["pending", "confirmed", "completed"].includes(b.status))
    .map((b) => ({ id: b.id, name: b.name, phone: b.phone, start: b.slots!.start_time, end: b.slots!.end_time, call_status: (b.call_status ?? "scheduled") as CallStatus }));

  const retryCalendar = (b: AdminBooking) =>
    start(async () => {
      const res = await retryBookingCalendar(b.id);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Done." } : { kind: "error", text: res.error });
      router.refresh();
    });

  const change2 = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    });

  const change = (id: string, patch: Parameters<typeof updateBooking>[1]) =>
    start(async () => {
      const res = await updateBooking(id, patch);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  return (
    <>
      <AdminHeader title="Bookings" subtitle="30-minute counselling voice calls. Call the student on their number at the booked time (India time)." />
      <TodaysCalls calls={todaysCalls} />
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
        {staff && staff.length > 0 && (
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="input sm:!w-52" aria-label="Assigned to">
            <option value="all">Anyone</option>
            <option value={me}>Assigned to me</option>
            <option value="none">Not assigned</option>
            {staff.filter((m) => m.id !== me).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
        )}
      </div>
      {!callReady && <div className="mb-4"><Notice kind="error">Run supabase/voice-calls.sql in Supabase to turn on call status (Called / No answer / Completed) and call notes.</Notice></div>}
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
              <li key={b.id} id={`booking-${b.id}`} className="card scroll-mt-24 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-extrabold text-slate-900">{b.name}</span>
                      {callReady && b.status !== "cancelled" && <CallStatusPill status={(b.call_status ?? "scheduled") as CallStatus} />}
                    </p>
                    <p className="text-sm text-slate-600">
                      {b.slots ? <><strong>{formatDate(b.slots.date, true)}</strong> · {formatTime(b.slots.start_time)} – {formatTime(b.slots.end_time)} IST · voice call · {formatPrice(b.slots.price)}</> : "Slot removed"}
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      {b.email && <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 hover:text-brand-700"><MailIcon className="h-3.5 w-3.5" /> {b.email}</a>}
                    </p>
                    {(b.class_year || b.expected_marks !== null && b.expected_marks !== undefined) && (
                      <p className="flex flex-wrap gap-2 text-xs">
                        {b.class_year && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">{b.class_year}</span>}
                        {b.expected_marks !== null && b.expected_marks !== undefined && (
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700">Expected marks: {+b.expected_marks}/500</span>
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
                    {staff && <BookingNotes bookingId={b.id} notes={notes[b.id] ?? []} me={me} isAdmin staffNames={staffNames} />}
                    {callReady && ["pending", "confirmed", "completed"].includes(b.status) && (
                      <CallStatusRow id={b.id} name={b.name} status={(b.call_status ?? "scheduled") as CallStatus} note={b.call_note ?? null} />
                    )}
                    {isUpcoming(b) && (b.calendar_status === "failed" || b.calendar_status === "not_connected") && (
                      <p className="text-xs text-amber-800">
                        Not in Google Calendar yet{b.calendar_status === "not_connected" ? " (not connected)" : ""}.{" "}
                        <button type="button" onClick={() => retryCalendar(b)} disabled={pending} className="font-semibold underline">Try again</button>
                      </p>
                    )}
                    <p className="text-xs text-slate-400">Booked {formatDateTime(b.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <CallButton phone={b.phone} name={b.name} />
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
                    {staff && staff.length > 0 && (
                      <select
                        value={b.assigned_to ?? ""}
                        onChange={(e) => change2(() => assignBooking(b.id, e.target.value || null))}
                        className="rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                        aria-label={`Assign ${b.name} to a counsellor`}
                      >
                        <option value="">Not assigned</option>
                        {staff.map((m) => <option key={m.id} value={m.id}>Assigned: {m.full_name || m.email}{m.role === "admin" ? " (admin)" : ""}</option>)}
                      </select>
                    )}
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

