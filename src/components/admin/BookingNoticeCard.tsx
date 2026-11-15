"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBookingNotice } from "@/app/admin/actions";
import { CheckIcon, ClockIcon } from "../Icons";
import { Label, Notice } from "./ui";

/** Admin → Settings → how long before a slot starts bookings close (default 60 minutes). */
export default function BookingNoticeCard({ initial }: { initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial ?? 60));
  const [saved, setSaved] = useState(String(initial ?? 60));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section id="booking-notice" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClockIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Booking notice</h2>
          <p className="text-sm text-slate-500">Students can&apos;t book a slot that starts sooner than this (checked in the database). Slots are 30-minute voice calls; all times are India time.</p>
        </div>
      </div>
      {initial === null ? (
        <div className="mt-4"><Notice kind="error">Run supabase/voice-calls.sql in Supabase → SQL Editor first. Until then bookings are allowed up to the start time.</Notice></div>
      ) : (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveBookingNotice(value);
              setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
              if (res.ok) { setSaved(value); router.refresh(); }
            });
          }}
        >
          <div>
            <Label htmlFor="bn-min">Bookings close this many minutes before a slot</Label>
            <input id="bn-min" type="number" min={0} max={2880} step={15} value={value} onChange={(e) => setValue(e.target.value)} className="input !w-40" />
          </div>
          {value !== saved ? (
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-4 w-4" /> Saved</span>
          )}
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
