"use client";

import { useId, useState } from "react";
import { formatBytes } from "@/lib/product-files";
import { SUBJECT_KEYS, SUBJECT_UI, type SubjectKey } from "../courses/SubjectIcon";
import PdfButtons from "./PdfButtons";
import type { SubjectFile } from "./SubjectFiles";

// A crash course in My Courses & Material: Physics · Chemistry · Mathematics tabs.
// Each PDF: Open PDF (new tab) + Download — the student's watermarked copy
// (/api/files/<id> checks access on every click). Only files the database
// already allowed this student to see are passed in.
export default function SubjectTabs({ files, title }: { files: SubjectFile[]; title: string }) {
  const other = files.filter((f) => !SUBJECT_KEYS.includes(f.subject as SubjectKey));
  const tabs: { key: string; label: string; items: SubjectFile[] }[] = [
    ...SUBJECT_KEYS.map((k) => ({ key: k as string, label: SUBJECT_UI[k].label, items: files.filter((f) => f.subject === k) })),
    ...(other.length ? [{ key: "other", label: "Other", items: other }] : []),
  ];
  const [active, setActive] = useState(() => tabs.find((t) => t.items.length)?.key ?? "physics");
  const id = useId();
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="mt-4">
      <div role="tablist" aria-label={`${title} subjects`} className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1 sm:inline-grid sm:auto-cols-fr sm:grid-flow-col">
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
              <span className="truncate">{t.label}</span>
              <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-brand-50 text-brand-700" : "bg-white/70"}`}>{t.items.length}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${id}-${current.key}-panel`} aria-labelledby={`${id}-${current.key}`} className="mt-3">
        {current.items.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500 ring-1 ring-slate-200">PDFs for this subject will be added soon.</p>
        ) : (
          <ul className="space-y-2">
            {current.items.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500 text-[11px] font-extrabold text-white">PDF</span>
                <div className="min-w-0 flex-1">
                  {f.chapter && <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">{f.chapter}</p>}
                  <p className="truncate font-semibold text-slate-900">{f.display_name}</p>
                  <p className="text-xs text-slate-500">PDF · watermarked with your name · {formatBytes(Number(f.size_bytes))}</p>
                </div>
                <PdfButtons fileId={f.id} name={f.display_name} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
