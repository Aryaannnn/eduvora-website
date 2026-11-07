"use client";

// Admin → Settings → Google Calendar & Meet: connect once, see status, disconnect.
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectGoogleCalendar } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import { CalendarIcon, VideoIcon } from "../Icons";
import { Notice } from "./ui";

export type CalendarStatus = { connected: boolean; email: string | null; connectedAt: string | null; lastError: string | null; setupMissing: boolean; configured: boolean };

const RESULT: Record<string, { kind: "success" | "error"; text: string }> = {
  connected: { kind: "success", text: "Google Calendar connected ✅ New bookings now get a Google Meet link automatically. Upcoming bookings without a link are being updated." },
  cancelled: { kind: "error", text: "Connection cancelled on Google's page. Nothing was changed." },
  expired: { kind: "error", text: "That connection attempt expired. Please click Connect Google Calendar again." },
  failed: { kind: "error", text: "Google did not finish the connection. Please try again." },
  "keys-missing": { kind: "error", text: "Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in Vercel (and .env.local) first, then redeploy." },
};

export default function GoogleCalendarCard({ status, expectedEmail }: { status: CalendarStatus; expectedEmail: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const q = params.get("google");
  const fromGoogle = q === "error" ? { kind: "error" as const, text: params.get("msg") || "Could not connect." } : q ? RESULT[q] : null;
  const shown = msg ?? fromGoogle;

  const disconnect = () => {
    if (!confirm("Disconnect Google Calendar? New bookings will show \"Meet link will be shared soon\" until you reconnect. Existing events stay in your calendar.")) return;
    start(async () => {
      const res = await disconnectGoogleCalendar();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Disconnected." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <section id="google-calendar" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><VideoIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Google Calendar &amp; Meet</h2>
          <p className="text-sm text-slate-500">
            When a counselling booking is confirmed, an event with a <strong>Google Meet link</strong> is added to your calendar and the student gets a calendar invite.
            Rescheduling moves the event; cancelling cancels it.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {status.setupMissing ? (
          <Notice kind="error">Run supabase/google-calendar.sql in Supabase → SQL Editor first.</Notice>
        ) : !status.configured ? (
          <Notice kind="error">Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in Vercel → Settings → Environment Variables (and .env.local), then redeploy.</Notice>
        ) : status.connected ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              {status.lastError ? (
                <p className="font-bold text-red-700">⚠️ Needs reconnecting</p>
              ) : (
                <p className="font-bold text-emerald-700">✅ Connected</p>
              )}
              <p className="mt-0.5 text-slate-600">
                <CalendarIcon className="mr-1 inline h-4 w-4" />
                {status.email ?? "Google account"}{status.connectedAt ? ` · since ${formatDateTime(status.connectedAt)}` : ""}
              </p>
              {status.lastError && <p className="mt-1 text-red-700">{status.lastError}</p>}
              {status.email && status.email.toLowerCase() !== expectedEmail.toLowerCase() && (
                <p className="mt-1 text-amber-700">Note: this is not {expectedEmail}. Events will go to this account&apos;s calendar.</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <a href="/api/admin/google/connect" className="btn-light !py-2 text-sm">Reconnect</a>
              <button type="button" onClick={disconnect} disabled={pending} className="btn-light !py-2 text-sm !text-red-700 disabled:opacity-50">{pending ? "…" : "Disconnect"}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/api/admin/google/connect" className="btn-primary"><CalendarIcon className="h-4 w-4" /> Connect Google Calendar</a>
            <p className="text-xs text-slate-500">Sign in with <strong>{expectedEmail}</strong> and tick the calendar permission. Until connected, students see &ldquo;Meet link will be shared soon&rdquo;.</p>
          </div>
        )}
      </div>
      {shown && <div className="mt-3"><Notice kind={shown.kind}>{shown.text}</Notice></div>}
    </section>
  );
}
