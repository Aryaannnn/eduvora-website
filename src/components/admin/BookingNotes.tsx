"use client";

// Staff notes on a counselling booking (admins + counsellors).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addBookingNote, deleteBookingNote } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import { TrashIcon } from "../Icons";

export type BookingNote = { id: string; body: string; created_at: string; created_by: string | null };

export default function BookingNotes({ bookingId, notes, me, isAdmin, staffNames }: { bookingId: string; notes: BookingNote[]; me: string; isAdmin: boolean; staffNames: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setErr(res.ok ? "" : (res.error ?? "Something went wrong."));
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="text-sm">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-semibold text-brand-700 underline" aria-expanded={open}>
        {open ? "Hide notes" : `Notes (${notes.length})`}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) run(() => addBookingNote(bookingId, text), () => setText(""));
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="e.g. Discussed Vellore CSE vs AP ECE; parents joined" className="input !py-1.5 text-sm" aria-label="New booking note" />
            <button type="submit" disabled={pending || !text.trim()} className="btn-primary !px-3 !py-1.5 text-sm disabled:opacity-50">Add</button>
          </form>
          {err && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
          {notes.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">No notes yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-slate-800">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{n.created_by ? `${staffNames[n.created_by] ?? "Staff"} · ` : ""}{formatDateTime(n.created_at)}</p>
                  </div>
                  {(isAdmin || n.created_by === me) && (
                    <button type="button" onClick={() => confirm("Delete this note?") && run(() => deleteBookingNote(n.id))} className="rounded p-1 text-slate-300 hover:text-red-600" aria-label="Delete note">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
