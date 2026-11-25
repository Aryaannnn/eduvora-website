"use client";

import { useId, useState } from "react";
import { setFileDone } from "@/lib/progress-actions";
import { formatBytes } from "@/lib/product-files";
import { SUBJECT_UI, subjectKeysFor, type SubjectKey } from "../courses/SubjectIcon";
import { CheckIcon, ExternalIcon } from "../Icons";
import PdfButtons from "./PdfButtons";
import SaveError, { safeSave, type SaveFailure } from "./SaveError";
import type { SubjectFile } from "./SubjectFiles";

export type TabProgress = Record<string, { done: boolean; done_at: string | null; last_opened_at: string | null }>;

// A course in My Courses & Material:
//  • overall progress bar + "Continue where you left off" (the last PDF opened)
//  • Physics · Chemistry · Mathematics (· English & Aptitude for the crash courses) tabs, each with "x of y done"
//  • every PDF: Open PDF + Download (watermarked, access checked by the server) and "Mark as done"
// Progress is saved per student (supabase/course-progress.sql — own rows only).
export default function SubjectTabs({ slug, files, title, progress = {}, tracking = true, newIds = [], startSubject }: { slug?: string; files: SubjectFile[]; title: string; progress?: TabProgress; tracking?: boolean; newIds?: string[]; startSubject?: string }) {
  const isNew = new Set(newIds);
  const SUBJECT_KEYS = subjectKeysFor(slug); // crash courses: 4 subjects · Formula Book / Question Bank: 3
  const other = files.filter((f) => !SUBJECT_KEYS.includes(f.subject as SubjectKey));
  const tabs: { key: string; label: string; items: SubjectFile[] }[] = [
    ...SUBJECT_KEYS.map((k) => ({ key: k as string, label: SUBJECT_UI[k].label, items: files.filter((f) => f.subject === k) })),
    ...(other.length ? [{ key: "other", label: "Other", items: other }] : []),
  ];
  const [active, setActive] = useState(() => (startSubject && tabs.some((t) => t.key === startSubject) ? startSubject : tabs.find((t) => t.items.some((f) => isNew.has(f.id)))?.key ?? tabs.find((t) => t.items.length)?.key ?? "physics"));
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(progress).map(([id, p]) => [id, p.done])));
  const [saving, setSaving] = useState<string>("");
  const [error, setError] = useState<SaveFailure | null>(null);
  const id = useId();
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  const count = (list: SubjectFile[]) => list.filter((f) => done[f.id]).length;
  const total = files.length;
  const allDone = count(files);
  const pct = total ? Math.round((allDone / total) * 100) : 0;
  const last = files
    .filter((f) => progress[f.id]?.last_opened_at)
    .sort((a, b) => String(progress[b.id]!.last_opened_at).localeCompare(String(progress[a.id]!.last_opened_at)))[0];

  async function toggle(f: SubjectFile, value: boolean) {
    setError(null);
    setSaving(f.id);
    setDone((d) => ({ ...d, [f.id]: value })); // show it at once
    const r = await safeSave("mark-pdf-done", () => setFileDone(f.id, value), { fileId: f.id });
    setSaving("");
    if (!r.ok) {
      setDone((d) => ({ ...d, [f.id]: !value })); // back to what is really saved
      setError({ message: r.error, again: () => void toggle(f, value) });
    }
  }

  return (
    <div className="mt-4">
      {tracking && total > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold text-slate-800">Course progress</span>
              <span className="text-slate-600"><strong className="text-slate-900">{pct}%</strong> · {allDone} of {total} PDFs done</span>
            </div>
            <Bar pct={pct} label={`${title}: ${pct}% done`} />
          </div>
          {last && (
            <a href={`/api/files/${last.id}/open`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700">
              <ExternalIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent-300">Continue where you left off</span>
                <span className="block truncate font-bold">{last.display_name}</span>
              </span>
            </a>
          )}
        </div>
      )}

      <div role="tablist" aria-label={`${title} subjects`} className={`grid ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-2xl bg-slate-200/70 p-1 sm:inline-grid sm:auto-cols-fr sm:grid-flow-col`}>
        {tabs.map((t) => {
          const ui = SUBJECT_UI[t.key as SubjectKey];
          const on = t.key === current.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${id}-${t.key}`}
              aria-selected={on}
              aria-controls={`${id}-${t.key}-panel`}
              onClick={() => setActive(t.key)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition sm:px-4 sm:text-sm ${on ? "bg-white text-brand-800 shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              {ui && <ui.Icon className="h-4 w-4 shrink-0" />}
              <span className="truncate">{ui ? <><span className="sm:hidden" aria-hidden>{ui.short}</span><span className="max-sm:sr-only">{t.label}</span></> : t.label}</span>
              <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-brand-50 text-brand-700" : "bg-white/70"}`}>{tracking ? `${count(t.items)}/${t.items.length}` : t.items.length}</span>
              {t.items.some((f) => isNew.has(f.id)) && <span className="rounded-full bg-accent-400 px-1.5 text-[10px] font-extrabold text-brand-950">{t.items.filter((f) => isNew.has(f.id)).length} new</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${id}-${current.key}-panel`} aria-labelledby={`${id}-${current.key}`} className="mt-3">
        {tracking && current.items.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-600">{current.label}: {count(current.items)} of {current.items.length} done</p>
            <Bar pct={Math.round((count(current.items) / current.items.length) * 100)} label={`${current.label} progress`} small />
          </div>
        )}
        <SaveError failure={error} className="mb-2" />
        {current.items.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500 ring-1 ring-slate-200">PDFs for this subject will be added soon.</p>
        ) : (
          <ul className="space-y-2">
            {current.items.map((f) => {
              const isDone = !!done[f.id];
              return (
                <li key={f.id} className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ring-1 ${isDone ? "bg-emerald-50/60 ring-emerald-200" : "bg-white ring-slate-200"}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white ${isDone ? "bg-emerald-600" : "bg-red-500"}`}>{isDone ? <CheckIcon className="h-5 w-5" /> : "PDF"}</span>
                  <div className="min-w-0 flex-1">
                    {f.chapter && <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">{f.chapter}</p>}
                    <p className="truncate font-semibold text-slate-900">
                      {isNew.has(f.id) && <span className="mr-1.5 rounded-full bg-accent-400 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase text-brand-950">New</span>}
                      {f.display_name}
                    </p>
                    <p className="text-xs text-slate-500">PDF · watermarked with your name · {formatBytes(Number(f.size_bytes))}</p>
                  </div>
                  {tracking && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={isDone} disabled={saving === f.id} onChange={(e) => void toggle(f, e.target.checked)} className="h-5 w-5 accent-emerald-600" />
                      {isDone ? "Done" : "Mark as done"}
                    </label>
                  )}
                  <PdfButtons fileId={f.id} name={f.display_name} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Bar({ pct, label, small }: { pct: number; label: string; small?: boolean }) {
  return (
    <div className={`mt-1.5 overflow-hidden rounded-full bg-slate-200 ${small ? "h-1.5" : "h-2.5"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-accent-400"}`} style={{ width: `${Math.max(pct, pct ? 2 : 0)}%` }} />
    </div>
  );
}
