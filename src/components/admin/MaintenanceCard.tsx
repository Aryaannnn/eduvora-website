"use client";

// Admin → Settings → Maintenance mode (on/off + message)
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveMaintenance } from "@/app/admin/actions";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/maintenance-shared";
import { Notice } from "./ui";

export type MaintenanceState = { enabled: boolean; message: string; updated_at: string | null } | null;

export default function MaintenanceCard({ state }: { state: MaintenanceState }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(state?.enabled ?? false);
  const [message, setMessage] = useState(state?.message || DEFAULT_MAINTENANCE_MESSAGE);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = !!state && (enabled !== state.enabled || message.trim() !== state.message);

  const save = () => {
    if (enabled && !state?.enabled && !confirm("Turn maintenance mode ON?\n\nVisitors and students will see the maintenance page until you turn it off. You (admins and counsellors) can keep using the website.")) return;
    start(async () => {
      const res = await saveMaintenance(enabled, message);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <section id="maintenance" className={`card mb-8 scroll-mt-24 p-5 sm:p-6 ${state?.enabled ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400 text-xl" aria-hidden>🛠️</span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Maintenance mode</h2>
            <p className="text-sm text-slate-500">
              When ON, visitors and students see a maintenance page (with WhatsApp and email buttons). Admins and counsellors keep using the site. Payments, webhooks, scheduled jobs and the admin login keep working.
            </p>
          </div>
        </div>
        {state && (
          <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${state.enabled ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-700"}`}>
            {state.enabled ? "● ON now" : "● OFF — site is open"}
          </span>
        )}
      </div>

      {!state ? (
        <div className="mt-4"><Notice kind="error">Run supabase/maintenance.sql in Supabase → SQL Editor first.</Notice></div>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-amber-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
            <span className="font-bold text-slate-800">{enabled ? "Maintenance mode ON" : "Maintenance mode OFF"}</span>
          </label>
          <div>
            <label htmlFor="mt-msg" className="text-sm font-semibold text-slate-700">Message on the maintenance page</label>
            <textarea id="mt-msg" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} className="input mt-1" />
            <button type="button" onClick={() => setMessage(DEFAULT_MAINTENANCE_MESSAGE)} className="mt-1 text-xs font-semibold text-brand-700 underline">Use the default message</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending || !changed || !message.trim()} className={`disabled:opacity-50 ${enabled ? "btn-accent" : "btn-primary"}`}>
              {pending ? "Saving…" : "Save"}
            </button>
            <a href="/admin/settings/maintenance-preview" target="_blank" className="text-sm font-semibold text-brand-700 underline">Preview the page</a>
          </div>
        </div>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
