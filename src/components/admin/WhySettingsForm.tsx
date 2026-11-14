"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveWhySettings } from "@/app/admin/actions";
import { DEFAULT_WHY, WHY_ICONS, WHY_LIMITS, type WhyCard, type WhyIcon, type WhySettings } from "@/lib/why-shared";
import { WHY_ICON_COMPONENTS, WHY_ICON_LABELS } from "../home/why-icons";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon, TrashIcon } from "../Icons";
import { Label, Notice, Toggle } from "./ui";

/** Admin → Settings → "Why EDUVORA?" cards on the home page. */
export default function WhySettingsForm({ initial, setupMissing }: { initial: WhySettings; setupMissing: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [title, setTitle] = useState(initial.title);
  const [cards, setCards] = useState<WhyCard[]>(initial.cards);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify({ enabled, title, cards }) !== saved;

  const update = (i: number, patch: Partial<WhyCard>) => setCards((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: -1 | 1) =>
    setCards((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveWhySettings({ enabled, title, cards });
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) {
        setSaved(JSON.stringify({ enabled, title, cards }));
        router.refresh();
      }
    });

  return (
    <section id="why" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">⭐ &ldquo;Why EDUVORA?&rdquo; cards (home page)</h2>
          <p className="text-sm text-slate-500">Up to {WHY_LIMITS.cards} cards shown just below the slideshow. Each card: an icon, a title, a short line and an optional link to a page on this website.</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? "Shown" : "Hidden"} />
      </div>

      {setupMissing ? (
        <div className="mt-4"><Notice kind="error">Run supabase/why-eduvora.sql in Supabase → SQL Editor first. Until then the home page shows the 4 default cards.</Notice></div>
      ) : (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="max-w-md">
            <Label htmlFor="why-title">Section heading</Label>
            <input id="why-title" value={title} maxLength={WHY_LIMITS.heading} onChange={(e) => setTitle(e.target.value)} className="input" />
          </div>

          <ol className="mt-5 grid gap-4 lg:grid-cols-2">
            {cards.map((c, i) => {
              const Icon = WHY_ICON_COMPONENTS[c.icon];
              return (
                <li key={i} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span>
                      Card {i + 1}
                    </p>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Move card ${i + 1} up`}><ArrowUpIcon /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === cards.length - 1} className="rounded-lg p-1.5 text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Move card ${i + 1} down`}><ArrowDownIcon /></button>
                      <button type="button" onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-red-600 hover:bg-white" aria-label={`Remove card ${i + 1}`}><TrashIcon /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <div>
                      <Label htmlFor={`why-icon-${i}`}>Icon</Label>
                      <select id={`why-icon-${i}`} value={c.icon} onChange={(e) => update(i, { icon: e.target.value as WhyIcon })} className="input">
                        {WHY_ICONS.map((k) => <option key={k} value={k}>{WHY_ICON_LABELS[k]}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`why-t-${i}`}>Title</Label>
                      <input id={`why-t-${i}`} value={c.title} maxLength={WHY_LIMITS.title} onChange={(e) => update(i, { title: e.target.value })} className="input" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label htmlFor={`why-x-${i}`}>Short text ({c.text.length}/{WHY_LIMITS.text})</Label>
                    <textarea id={`why-x-${i}`} rows={2} value={c.text} maxLength={WHY_LIMITS.text} onChange={(e) => update(i, { text: e.target.value })} className="input" />
                  </div>
                  <div className="mt-3">
                    <Label htmlFor={`why-h-${i}`}>Link (optional)</Label>
                    <input id={`why-h-${i}`} value={c.href} onChange={(e) => update(i, { href: e.target.value })} className="input" placeholder="/book-a-slot  (empty = no link)" />
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {cards.length < WHY_LIMITS.cards && (
              <button type="button" onClick={() => setCards((cs) => [...cs, { icon: "graduation", title: "", text: "", href: "" }])} className="btn-light">
                <PlusIcon /> Add card
              </button>
            )}
            <button type="button" onClick={() => setCards(DEFAULT_WHY.cards)} className="text-sm font-semibold text-slate-600 underline">Reset to the original 4 cards</button>
            <span className="flex-1" />
            {dirty ? (
              <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-4 w-4" /> Saved</span>
            )}
          </div>
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
