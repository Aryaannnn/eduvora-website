"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGrowthSettings } from "@/app/admin/actions";
import { CheckIcon, MegaphoneIcon } from "../Icons";
import { Label, Notice, Toggle } from "./ui";

export type LeadCaptureState = { guide_enabled: boolean; guide_product_id: string | null; abandoned_reminders: boolean } | null;

/** Admin → Settings → Lead capture: free guide popup + "You left something behind" emails. */
export default function LeadCaptureCard({ initial, freeProducts }: { initial: LeadCaptureState; freeProducts: { id: string; title: string; hasFile: boolean }[] }) {
  const router = useRouter();
  const [s, setS] = useState(initial ?? { guide_enabled: true, guide_product_id: null, abandoned_reminders: false });
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(s) !== saved;
  const chosen = freeProducts.find((p) => p.id === s.guide_product_id);

  const save = () =>
    start(async () => {
      const res = await saveGrowthSettings(s);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) {
        setSaved(JSON.stringify(s));
        router.refresh();
      }
    });

  return (
    <section id="lead-capture" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MegaphoneIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Lead capture</h2>
          <p className="text-sm text-slate-500">A free guide popup for visitors, and friendly reminders for unfinished payments. People who ask for the guide appear in Admin → Leads as &ldquo;Free guide&rdquo;.</p>
        </div>
      </div>

      {initial === null ? (
        <div className="mt-4"><Notice kind="error">Run supabase/lead-capture.sql in Supabase → SQL Editor first.</Notice></div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold text-slate-900">1. Free guide popup</p>
              <Toggle checked={s.guide_enabled} onChange={(v) => setS({ ...s, guide_enabled: v })} label={s.guide_enabled ? "On" : "Off"} />
            </div>
            <p className="mt-1 text-sm text-slate-600">Shown once per visitor after they scroll 60% of a page or stay 30 seconds. Never on checkout, payment, login, dashboard or admin pages, and not to logged-in students.</p>
            <div className="mt-3 max-w-md">
              <Label htmlFor="lc-guide">Which free resource is the guide?</Label>
              <select id="lc-guide" value={s.guide_product_id ?? ""} onChange={(e) => setS({ ...s, guide_product_id: e.target.value || null })} className="input">
                <option value="">— choose (upload it in Admin → Products as a FREE item) —</option>
                {freeProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}{p.hasFile ? "" : " (no PDF yet)"}</option>
                ))}
              </select>
              {chosen && !chosen.hasFile && <p className="mt-1 text-xs font-semibold text-amber-700">Add the PDF to this product first — the popup stays hidden until it has a file.</p>}
              {freeProducts.length === 0 && <p className="mt-1 text-xs text-slate-500">No free products yet. Add one in Admin → Products, tick &ldquo;Free&rdquo;, and upload the PDF.</p>}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold text-slate-900">2. &ldquo;You left something behind&rdquo; emails</p>
              <Toggle checked={s.abandoned_reminders} onChange={(v) => setS({ ...s, abandoned_reminders: v })} label={s.abandoned_reminders ? "On" : "Off"} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              When a logged-in student starts a payment and doesn&apos;t finish: ONE friendly email after 2 hours and ONE after 24 hours, with a link back. Never if they paid, only the newest attempt per item, only payments started after you switch this on.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            {dirty ? (
              <button type="button" onClick={save} disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-4 w-4" /> Saved</span>
            )}
          </div>
        </div>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
