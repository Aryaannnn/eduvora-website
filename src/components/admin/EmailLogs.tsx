"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resendEmail } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import { MailIcon, SearchIcon } from "../Icons";
import { AdminHeader, Notice } from "./ui";

export type EmailLog = {
  id: string; kind: string; ref_id: string | null; to_email: string; subject: string; status: "sent" | "failed";
  error: string | null; attempts: number; created_at: string; updated_at: string;
};

const KIND: Record<string, string> = {
  payment_success: "Payment receipt",
  booking_confirmed: "Booking confirmed",
  reminder_24h: "Reminder · 24 hours",
  reminder_1h: "Reminder · 1 hour",
  booking_cancelled: "Booking cancelled",
  booking_rescheduled: "Booking rescheduled",
  welcome: "Welcome",
  meet_link: "Google Meet link",
  feedback_request: "Feedback request",
  admin_payment: "Admin · new payment",
  admin_booking: "Admin · new booking",
  admin_enquiry: "Admin · new enquiry",
};

export default function EmailLogs({ logs }: { logs: EmailLog[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "failed" | "sent">("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [, start] = useTransition();

  const failed = logs.filter((l) => l.status === "failed").length;
  const shown = logs.filter(
    (l) => (filter === "all" || l.status === filter) && (!q || `${l.to_email} ${l.subject} ${KIND[l.kind] ?? l.kind}`.toLowerCase().includes(q.toLowerCase())),
  );

  const resend = (id: string) => {
    setBusyId(id);
    start(async () => {
      const res = await resendEmail(id);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Sent." } : { kind: "error", text: res.error });
      setBusyId("");
      router.refresh();
    });
  };

  return (
    <>
      <AdminHeader title="Email Logs" subtitle="Every email the website sent. Failed ones never affect payments or bookings — resend them here." />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {(["all", "sent", "failed"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`card p-4 text-left transition ${filter === f ? "ring-2 ring-brand-600" : ""}`}>
            <span className={`block text-2xl font-extrabold ${f === "failed" && failed ? "text-red-600" : "text-slate-900"}`}>
              {f === "all" ? logs.length : f === "failed" ? failed : logs.length - failed}
            </span>
            <span className="text-sm font-semibold capitalize text-slate-500">{f}</span>
          </button>
        ))}
      </div>
      <div className="card mb-4 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email address or subject…" className="input !pl-9" aria-label="Search emails" />
        </div>
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">{logs.length === 0 ? "No emails sent yet." : "No emails match."}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((l) => (
            <li key={l.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${l.status === "sent" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{l.status === "sent" ? "Sent" : "Failed"}</span>
                  <span className="text-xs font-semibold text-slate-500">{KIND[l.kind] ?? l.kind}</span>
                  {l.attempts > 1 && <span className="text-xs text-slate-400">· {l.attempts} attempts</span>}
                </p>
                <p className="truncate font-semibold text-slate-900">{l.subject}</p>
                <p className="flex items-center gap-1 text-sm text-slate-600"><MailIcon className="h-3.5 w-3.5" /> {l.to_email}</p>
                <p className="text-xs text-slate-400">{formatDateTime(l.updated_at)}</p>
                {l.status === "failed" && l.error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 ring-1 ring-red-100">{l.error}</p>}
              </div>
              {l.ref_id && (
                <button type="button" disabled={busyId === l.id} onClick={() => resend(l.id)} className={`${l.status === "failed" ? "btn-primary" : "btn-light"} shrink-0 !px-4 !py-2 text-sm disabled:opacity-60`}>
                  {busyId === l.id ? "Sending…" : "Resend"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
