"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveVitGuide } from "@/app/admin/actions";
import { countPlaceholders, DEFAULT_GUIDE, GUIDE_LIMITS, type GuideFaq, type GuideSection, type VitGuide } from "@/lib/vit-guide-shared";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "../Icons";
import { Label, Notice } from "./ui";

/** Admin → Settings → the text of /vit-counselling-guide (check the facts every year). */
export default function VitGuideForm({ initial, setupMissing, savedBefore }: { initial: VitGuide; setupMissing: boolean; savedBefore: boolean }) {
  const router = useRouter();
  const [g, setG] = useState<VitGuide>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(g) !== saved;
  const left = countPlaceholders(g);

  const set = (patch: Partial<VitGuide>) => setG((x) => ({ ...x, ...patch }));
  const setSection = (i: number, patch: Partial<GuideSection>) => set({ sections: g.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setFaq = (i: number, patch: Partial<GuideFaq>) => set({ faqs: g.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = <T,>(list: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const save = () =>
    start(async () => {
      const res = await saveVitGuide(g);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) {
        setSaved(JSON.stringify(g));
        router.refresh();
      }
    });

  return (
    <section id="vit-guide" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">🧭 VIT Counselling Guide</h2>
          <p className="text-sm text-slate-500">
            The text of <Link href="/vit-counselling-guide" target="_blank" className="font-semibold text-brand-700 underline">/vit-counselling-guide</Link>. Check every fact on vit.ac.in / viteee.vit.ac.in each year.
            Write anything you still need to confirm as <code className="rounded bg-slate-100 px-1 text-xs">[[FILL: what]]</code> — the page then shows &ldquo;to be confirmed — check the official VIT website&rdquo; instead of a guess.
            In a section, a blank line starts a new paragraph and a line starting with <code className="rounded bg-slate-100 px-1 text-xs">- </code> is a bullet point.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${left ? "bg-amber-50 text-amber-800 ring-amber-300" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
          {left ? `${left} placeholder${left === 1 ? "" : "s"} to fill in` : "All facts filled in"}
        </span>
      </div>

      {setupMissing ? (
        <div className="mt-4"><Notice kind="error">Run supabase/vit-guide.sql in Supabase → SQL Editor first. Until then the page shows the starting text (with placeholders).</Notice></div>
      ) : (
        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {!savedBefore && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">This is the starting text. Check it, fill in the placeholders and click Save to make it yours.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="vg-year">Counselling year (shown in the title)</Label>
              <input id="vg-year" value={g.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="e.g. 2027" className="input" />
            </div>
            <div>
              <Label htmlFor="vg-checked">Facts last checked on the official site</Label>
              <input id="vg-checked" type="date" value={g.checkedOn} onChange={(e) => set({ checkedOn: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <Label htmlFor="vg-intro">Introduction ({g.intro.length}/{GUIDE_LIMITS.intro})</Label>
            <textarea id="vg-intro" value={g.intro} onChange={(e) => set({ intro: e.target.value })} rows={3} maxLength={GUIDE_LIMITS.intro} className="input" />
          </div>

          <div className="space-y-4">
            <p className="font-bold text-slate-900">Sections ({g.sections.length}/{GUIDE_LIMITS.sections})</p>
            {g.sections.map((s, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-500">{i + 1}.</span>
                  <input value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} maxLength={GUIDE_LIMITS.title} aria-label={`Section ${i + 1} heading`} className="input min-w-0 flex-1 font-bold" />
                  <button type="button" onClick={() => set({ sections: move(g.sections, i, -1) })} disabled={i === 0} className="btn-light !px-2 !py-2 disabled:opacity-40" aria-label="Move up"><ArrowUpIcon className="h-4 w-4" /></button>
                  <button type="button" onClick={() => set({ sections: move(g.sections, i, 1) })} disabled={i === g.sections.length - 1} className="btn-light !px-2 !py-2 disabled:opacity-40" aria-label="Move down"><ArrowDownIcon className="h-4 w-4" /></button>
                  <button type="button" onClick={() => set({ sections: g.sections.filter((_, j) => j !== i) })} disabled={g.sections.length === 1} className="btn-light !px-2 !py-2 !text-red-600 disabled:opacity-40" aria-label="Remove section"><TrashIcon className="h-4 w-4" /></button>
                </div>
                <textarea value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} rows={8} maxLength={GUIDE_LIMITS.body} aria-label={`Section ${i + 1} text`} className="input mt-2 font-mono text-sm" />
              </div>
            ))}
            {g.sections.length < GUIDE_LIMITS.sections && (
              <button type="button" onClick={() => set({ sections: [...g.sections, { id: "", title: "", body: "" }] })} className="btn-light !py-2 text-sm"><PlusIcon className="h-4 w-4" /> Add a section</button>
            )}
          </div>

          <div className="space-y-3">
            <p className="font-bold text-slate-900">Questions (shown as FAQ; complete ones also go to Google) ({g.faqs.length}/{GUIDE_LIMITS.faqs})</p>
            {g.faqs.map((f, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex gap-2">
                  <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} maxLength={GUIDE_LIMITS.q} placeholder="Question" aria-label={`Question ${i + 1}`} className="input flex-1 font-semibold" />
                  <button type="button" onClick={() => set({ faqs: g.faqs.filter((_, j) => j !== i) })} className="btn-light !px-2 !py-2 !text-red-600" aria-label="Remove question"><TrashIcon className="h-4 w-4" /></button>
                </div>
                <textarea value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} rows={2} maxLength={GUIDE_LIMITS.a} placeholder="Answer" aria-label={`Answer ${i + 1}`} className="input mt-2 text-sm" />
              </div>
            ))}
            {g.faqs.length < GUIDE_LIMITS.faqs && (
              <button type="button" onClick={() => set({ faqs: [...g.faqs, { q: "", a: "" }] })} className="btn-light !py-2 text-sm"><PlusIcon className="h-4 w-4" /> Add a question</button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={pending || !dirty} className="btn-primary disabled:opacity-50">{pending ? "Saving…" : dirty ? "Save guide" : "Saved"}</button>
            <button type="button" onClick={() => window.confirm("Replace the form with the starting text? (Nothing changes on the website until you click Save.)") && setG(DEFAULT_GUIDE)} className="btn-light !py-2 text-sm">Start again from the starting text</button>
          </div>
          {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        </form>
      )}
    </section>
  );
}
