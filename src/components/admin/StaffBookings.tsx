"use client";

// Admin → Bookings as a COUNSELLOR sees it: no amounts, payments or invoices
// (the data comes from the staff_bookings view, which doesn't have them).
// Can: call / WhatsApp / join Meet, mark completed, add notes, filter "Assigned to me".
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { staffCompleteBooking } from "@/app/admin/actions";
import { formatDate, formatTime } from "@/lib/format";
import { CheckIcon, PhoneIcon, SearchIcon, VideoIcon, WhatsAppIcon } from "../Icons";
import BookingNotes, { type BookingNote } from "./BookingNotes";
import { AdminHeader, Notice } from "./ui";

export type StaffBooking = {
  id: string; name: string; phone: string; email: string | null; class_year: string | null; expected_marks: number | null; message: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed"; created_at: string; meet_link: string | null; assigned_to: string | null;
  slot_date: string | null; slot_start: string | null; slot_end: string | null;
};

const statusColor: Record<string, string> = { pending: "bg-amber-50 text-amber-800", confirmed: "bg-green-50 text-green-700", completed: "bg-slate-100 text-slate-700", cancelled: "bg-red-50 text-red-700" };
const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function StaffBookings({ bookings, notes, today, me, staffNames, notAllowed }: { bookings: StaffBooking[]; notes: Record<string, BookingNote[]>; today: string; me: string; staffNames: Record<string, string>; notAllowed: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"upcoming" | "today" | "completed" | "all">("upcoming");
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(notAllowed ? { kind: "error", text: "That page is for admins only. As a counsellor you can use Bookings, Leads, Students and Enquiries." } : null);
  const [pending, start] = useTransition();

  const shown = bookings.filter((b) => {
    const upcoming = !!b.slot_date && b.slot_date >= today && ["pending", "confirmed"].includes(b.status);
    const ok = filter === "all" ? true : filter === "upcoming" ? upcoming : filter === "today" ? b.slot_date === today && b.status !== "cancelled" : b.status === "completed";
    const text = `${b.name} ${b.phone} ${b.email ?? ""}`.toLowerCase();
    return ok && (!mine || b.assigned_to === me) && (!q || text.includes(q.toLowerCase()));
  });

  const complete = (b: StaffBooking) => {
    if (!confirm(`Mark ${b.name}'s session as completed?`)) return;
    start(async () => {
      const res = await staffCompleteBooking(b.id);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Done." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <>
      <AdminHeader title="Bookings" subtitle="Counselling sessions. Payment details are only visible to admins." />
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email…" className="input !pl-9" aria-label="Search bookings" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input sm:!w-48" aria-label="Filter bookings">
          <option value="upcoming">Upcoming</option>
          <option value="today">Today</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Assigned to me ({bookings.filter((b) => b.assigned_to === me).length})
        </label>
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No bookings here.</p>
      ) : (
        <ul className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
          {shown.map((b) => {
            const phone = intlPhone(b.phone);
            const wa = `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${b.name}, this is about your counselling session${b.slot_date ? ` on ${formatDate(b.slot_date)} at ${formatTime(b.slot_start ?? "")}` : ""}.`)}`;
            return (
              <li key={b.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-extrabold text-slate-900">{b.name}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusColor[b.status]}`}>{b.status}</span>
                      {b.assigned_to && <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{b.assigned_to === me ? "Assigned to you" : `Assigned: ${staffNames[b.assigned_to] ?? "staff"}`}</span>}
                    </p>
                    <p className="text-sm text-slate-600">
                      {b.slot_date ? <><strong>{formatDate(b.slot_date, true)}</strong> · {formatTime(b.slot_start ?? "")} – {formatTime(b.slot_end ?? "")} IST</> : "Slot removed"}
                    </p>
                    <p className="text-sm text-slate-600">{b.phone}{b.email ? ` · ${b.email}` : ""}</p>
                    {(b.class_year || b.expected_marks !== null) && (
                      <p className="flex flex-wrap gap-2 text-xs">
                        {b.class_year && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">{b.class_year}</span>}
                        {b.expected_marks !== null && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700">Expected marks: {+b.expected_marks}/125</span>}
                      </p>
                    )}
                    {b.message && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">“{b.message}”</p>}
                    <BookingNotes bookingId={b.id} notes={notes[b.id] ?? []} me={me} isAdmin={false} staffNames={staffNames} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-end">
                    <div className="flex gap-2">
                      {b.meet_link && ["pending", "confirmed"].includes(b.status) && (
                        <a href={b.meet_link} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-emerald-600 !px-4 !py-2 text-sm"><VideoIcon className="h-4 w-4" /> Join Meet</a>
                      )}
                      <a href={`tel:+${phone}`} className="btn-primary !px-4 !py-2 text-sm"><PhoneIcon className="h-4 w-4" /> Call</a>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !px-4 !py-2 text-sm"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
                    </div>
                    {["pending", "confirmed"].includes(b.status) && (
                      <button type="button" onClick={() => complete(b)} disabled={pending} className="btn-light !px-4 !py-2 text-sm"><CheckIcon className="h-4 w-4" /> Mark completed</button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
