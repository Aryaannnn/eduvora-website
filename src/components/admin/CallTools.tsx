"use client";

// Admin → Bookings: counselling is a 30-minute VOICE CALL.
//  • CallButton      — big "Call" (tel:) button with the student's number
//  • CallStatusRow   — Called · No answer · Completed + a short note
//  • TodaysCalls     — today's calls at the top, sorted by time
// Status + note are saved with staff_set_call (supabase/voice-calls.sql).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setCallStatus } from "@/app/admin/actions";
import { formatPhoneIN, formatTime } from "@/lib/format";
import { PhoneIcon } from "../Icons";

export type CallStatus = "scheduled" | "called" | "no_answer" | "completed";

export const CALL_LABEL: Record<CallStatus, string> = { scheduled: "Not called yet", called: "Called", no_answer: "No answer", completed: "Completed" };
export const CALL_COLOR: Record<CallStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700",
  called: "bg-blue-50 text-blue-800",
  no_answer: "bg-amber-50 text-amber-900",
  completed: "bg-emerald-50 text-emerald-800",
};

/** "9876543210" / "+91 98765 43210" → "tel:+919876543210" */
export const telHref = (p: string) => {
  const d = p.replace(/\D/g, "");
  return `tel:+${d.length === 10 ? `91${d}` : d}`;
};

export function CallButton({ phone, name, size = "lg" }: { phone: string; name: string; size?: "lg" | "md" }) {
  return (
    <a
      href={telHref(phone)}
      className={`btn-primary !bg-emerald-600 hover:!bg-emerald-700 ${size === "lg" ? "!px-5 !py-3 text-base" : "!px-4 !py-2 text-sm"}`}
      aria-label={`Call ${name} on ${formatPhoneIN(phone)}`}
    >
      <PhoneIcon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} /> Call <span className="font-semibold opacity-90">{formatPhoneIN(phone)}</span>
    </a>
  );
}

export function CallStatusPill({ status }: { status: CallStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CALL_COLOR[status]}`}>📞 {CALL_LABEL[status]}</span>;
}

/** Mark as called / no answer / completed, and a note. */
export function CallStatusRow({ id, name, status, note }: { id: string; name: string; status: CallStatus; note: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (next: CallStatus, withNote: boolean) => {
    if (next === "completed" && status !== "completed" && !confirm(`Mark ${name}'s call as completed? The booking is marked completed too (the student gets the feedback email).`)) return;
    start(async () => {
      const res = await setCallStatus(id, next, withNote ? text : null);
      setMsg(res.ok ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  };

  const btn = (s: CallStatus, label: string) => (
    <button
      type="button"
      disabled={pending}
      aria-pressed={status === s}
      onClick={() => save(s, false)}
      className={`min-h-[40px] rounded-xl px-3 text-sm font-bold ring-1 disabled:opacity-50 ${status === s ? `${CALL_COLOR[s]} ring-current` : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Call</span>
        {btn("called", "Called")}
        {btn("no_answer", "No answer")}
        {btn("completed", "Completed")}
        {status !== "scheduled" && (
          <button type="button" disabled={pending} onClick={() => save("scheduled", false)} className="text-xs font-semibold text-slate-500 underline">
            Reset
          </button>
        )}
      </div>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          save(status, true);
        }}
      >
        <label htmlFor={`call-note-${id}`} className="sr-only">Call note for {name}</label>
        <input
          id={`call-note-${id}`}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Call note (e.g. call back at 7 PM, father joined…)"
          className="input !py-2 text-sm"
        />
        <button type="submit" disabled={pending || text === (note ?? "")} className="btn-light !px-4 !py-2 text-sm disabled:opacity-50">Save note</button>
      </form>
      {msg && <p className={`mt-1 text-xs font-semibold ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</p>}
    </div>
  );
}

export type TodayCall = { id: string; name: string; phone: string; start: string; end: string; call_status: CallStatus };

/** Today's calls at the top of Admin → Bookings, sorted by time. */
export function TodaysCalls({ calls }: { calls: TodayCall[] }) {
  if (calls.length === 0) return null;
  const sorted = [...calls].sort((a, b) => a.start.localeCompare(b.start));
  const left = sorted.filter((c) => c.call_status === "scheduled" || c.call_status === "no_answer").length;
  return (
    <section aria-labelledby="todays-calls" className="card mb-4 border-2 border-emerald-200 p-4 sm:p-5">
      <h2 id="todays-calls" className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-slate-900">
        <PhoneIcon className="h-5 w-5 text-emerald-600" /> Today&apos;s calls
        <span className="text-sm font-semibold text-slate-500">({sorted.length} · {left} still to call · India time)</span>
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {sorted.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">
                <span className="mr-2 tabular-nums text-brand-700">{formatTime(c.start)} – {formatTime(c.end)}</span>
                <a href={`#booking-${c.id}`} className="hover:underline">{c.name}</a>
              </p>
              <p className="mt-0.5"><CallStatusPill status={c.call_status} /></p>
            </div>
            <CallButton phone={c.phone} name={c.name} size="md" />
          </li>
        ))}
      </ul>
    </section>
  );
}
