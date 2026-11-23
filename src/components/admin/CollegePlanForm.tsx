"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCollegePlan, unpublishCollegePlan } from "@/lib/college-plan-actions";
import { FEE_CATEGORY_HINTS, toLines, type CollegePlan } from "@/lib/college-plan";
import { formatDateTime } from "@/lib/format";
import { Label } from "./ui";

// Write / edit a booking's college plan. Lists: ONE item per line (the order is kept).
// "Save draft" = only staff see it; "Publish" = the student sees it (+ PDF) at once.
export default function CollegePlanForm({ bookingId, plan }: { bookingId: string; plan: CollegePlan | null }) {
  const router = useRouter();
  const join = (l?: string[]) => (l ?? []).join("\n");
  const [f, setF] = useState({
    campuses: join(plan?.campuses),
    branches: join(plan?.branches),
    fee_category: plan?.fee_category ?? "",
    choice_order: join(plan?.choice_order),
    next_steps: join(plan?.next_steps),
    notes: plan?.notes ?? "",
  });
  const [busy, setBusy] = useState<"" | "draft" | "publish" | "unpublish">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const published = plan?.status === "published";

  async function save(publish: boolean) {
    if (publish && !confirm(published ? "Update the published plan? The student sees the new version at once (with a “New” badge)." : "Publish this plan? The student sees it in My Bookings at once and can download it as a PDF.")) return;
    setBusy(publish ? "publish" : "draft");
    setMsg(null);
    const r = await saveCollegePlan(
      bookingId,
      { campuses: toLines(f.campuses, 10), branches: toLines(f.branches, 15), fee_category: f.fee_category, choice_order: toLines(f.choice_order, 30), next_steps: toLines(f.next_steps, 20), notes: f.notes },
      publish,
    );
    setBusy("");
    setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  async function unpublish() {
    if (!confirm("Hide this plan from the student again (back to draft)?")) return;
    setBusy("unpublish");
    const r = await unpublishCollegePlan(bookingId);
    setBusy("");
    setMsg(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  const area = (id: string, k: keyof typeof f, label: string, hint: string, rows = 4) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} rows={rows} value={f[k]} onChange={(e) => set(k, e.target.value)} className="input" placeholder={hint} />
    </div>
  );

  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <p className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${published ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : plan ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
        {published
          ? `✓ Published${plan?.published_at ? ` on ${formatDateTime(plan.published_at)}` : ""} — the student can see it${plan?.seen_at ? " (opened by the student)" : " (not opened yet)"}.`
          : plan
            ? "Draft — only admins and counsellors can see it."
            : "New plan — one item per line in each list. Save a draft any time; publish when it's ready."}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {area("cp-campuses", "campuses", "Recommended campuses (in order, one per line)", "VIT Vellore\nVIT Chennai\nVIT-AP")}
        {area("cp-branches", "branches", "Recommended branches (one per line)", "CSE (Core)\nCSE with AI & ML\nECE")}
        <div>
          <Label htmlFor="cp-fee">Expected fee category</Label>
          <input id="cp-fee" list="cp-fee-list" value={f.fee_category} onChange={(e) => set("fee_category", e.target.value)} maxLength={60} className="input" placeholder="e.g. Category 2" />
          <datalist id="cp-fee-list">{FEE_CATEGORY_HINTS.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="hidden lg:block" aria-hidden />
        {area("cp-order", "choice_order", "Choice-filling order (one choice per line)", "VIT Vellore – CSE (Core)\nVIT Chennai – CSE (Core)\nVIT Vellore – CSE with AI & ML", 6)}
        {area("cp-steps", "next_steps", "Next steps (checklist, one per line)", "Register for VIT counselling on the official site\nKeep documents ready: …\nFill choices in the order above", 6)}
      </div>
      {area("cp-notes", "notes", "Notes (optional)", "Anything else the student should know", 4)}

      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${msg.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save(false)} disabled={!!busy} className="btn-light disabled:opacity-60">{busy === "draft" ? "Saving…" : published ? "Save as draft (hide from student)" : "Save draft"}</button>
        <button type="button" onClick={() => void save(true)} disabled={!!busy} className="btn-primary disabled:opacity-60">{busy === "publish" ? "Publishing…" : published ? "Update published plan" : "Publish to student"}</button>
        {published && <button type="button" onClick={() => void unpublish()} disabled={!!busy} className="btn-light !text-red-600 disabled:opacity-60">{busy === "unpublish" ? "…" : "Unpublish"}</button>}
      </div>
    </div>
  );
}
