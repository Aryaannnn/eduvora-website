"use client";

// =====================================================================
//  ADMIN → PRODUCTS → (crash course) → STUDY PLAN
//  Days: day number, subject(s), topics, linked PDFs (picked from this
//  course's files), short note. Add / edit / delete / ↑ ↓, and bulk import
//  from a CSV (sample below). Saved instantly — no need to press Save.
// =====================================================================
import { useEffect, useState } from "react";
import { listProductFiles } from "@/app/admin/file-actions";
import { deletePlanDay, importPlanCsv, listPlanDays, savePlanDay, swapPlanDays } from "@/app/admin/study-plan-actions";
import { PDF_SUBJECTS, type ProductFile } from "@/lib/product-files";
import { SAMPLE_CSV, type PlanDay } from "@/lib/study-plan";
import { EditIcon, PlusIcon, TrashIcon } from "../Icons";

type Draft = { id?: string; day_number: number; subjects: string[]; topics: string; file_ids: string[]; note: string };
const SUBJECT_NAMES = PDF_SUBJECTS.map((s) => s.label);

export default function StudyPlanEditor({ productId }: { productId: string }) {
  const [days, setDays] = useState<PlanDay[] | null>(null);
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);

  const reload = async () => {
    const [d, f] = await Promise.all([listPlanDays(productId), listProductFiles(productId)]);
    if (!d.ok) setMsg({ ok: false, text: d.error });
    setDays(d.ok ? d.data!.days : []);
    setFiles(f.ok ? (f.data!.files ?? []).filter((x) => x.file_type === "pdf") : []);
  };
  useEffect(() => {
    let alive = true;
    Promise.all([listPlanDays(productId), listProductFiles(productId)]).then(([d, f]) => {
      if (!alive) return;
      if (!d.ok) setMsg({ ok: false, text: d.error });
      setDays(d.ok ? d.data!.days : []);
      setFiles(f.ok ? (f.data!.files ?? []).filter((x) => x.file_type === "pdf") : []);
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const fileName = (id: string) => files.find((f) => f.id === id)?.display_name ?? "(removed PDF)";
  const nextDay = () => Math.max(0, ...(days ?? []).map((d) => d.day_number)) + 1;

  async function save() {
    if (!draft) return;
    setBusy(true);
    const r = await savePlanDay(productId, { ...draft, topics: draft.topics.split("\n").map((t) => t.trim()).filter(Boolean) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setDraft(null);
    setMsg({ ok: true, text: r.message ?? "Saved." });
    await reload();
  }
  async function remove(d: PlanDay) {
    if (!confirm(`Delete Day ${d.day_number}${d.is_sample ? " (SAMPLE)" : ""}? Students' "done" ticks for this day are removed too.`)) return;
    const r = await deletePlanDay(d.id);
    setMsg(r.ok ? { ok: true, text: "Day deleted." } : { ok: false, text: r.error });
    await reload();
  }
  async function move(i: number, j: number) {
    if (!days || j < 0 || j >= days.length) return;
    const r = await swapPlanDays(days[i].id, days[j].id);
    if (!r.ok) setMsg({ ok: false, text: r.error });
    await reload();
  }
  async function importFile(file: File) {
    if (replace && !confirm("Replace ALL current days of this course with the CSV? Students' ticks for removed days are removed too.")) return;
    setBusy(true);
    setWarnings([]);
    const r = await importPlanCsv(productId, await file.text(), replace);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: r.message ?? "Imported." });
    setWarnings(r.data!.warnings);
    await reload();
  }
  function downloadSample() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    a.download = "study-plan-sample.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setDraft({ day_number: nextDay(), subjects: [], topics: "", file_ids: [], note: "" })} className="btn-primary !px-3 !py-2 text-sm"><PlusIcon /> Add day</button>
        <label className="btn-light cursor-pointer !px-3 !py-2 text-sm">
          Import CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace existing days</label>
        <button type="button" onClick={downloadSample} className="text-xs font-semibold text-brand-700 underline">Download sample CSV</button>
      </div>
      <p className="text-xs text-slate-500">
        CSV columns: <code>day,subjects,topics,pdfs,note</code> — several subjects / topics / PDFs in one cell are separated by <code>;</code>. PDFs are matched by their title in Files. Importing always removes the SAMPLE days.
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${msg.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{msg.text}</p>}
      {warnings.length > 0 && <ul className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">{warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}</ul>}

      {draft && (
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-2 ring-brand-300">
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <label className="text-sm font-semibold text-slate-700">Day
              <input type="number" min={1} max={400} value={draft.day_number} onChange={(e) => setDraft({ ...draft, day_number: Number(e.target.value) })} className="input mt-1" />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Subject(s)</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {SUBJECT_NAMES.map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={draft.subjects.includes(n)} onChange={(e) => setDraft({ ...draft, subjects: e.target.checked ? [...draft.subjects, n] : draft.subjects.filter((x) => x !== n) })} /> {n}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="block text-sm font-semibold text-slate-700">Topics (one per line)
            <textarea rows={3} value={draft.topics} onChange={(e) => setDraft({ ...draft, topics: e.target.value })} className="input mt-1" />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700">Linked PDFs (from this course)</legend>
            {files.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Upload PDFs in Files first, then link them here.</p>
            ) : (
              <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={draft.file_ids.includes(f.id)} onChange={(e) => setDraft({ ...draft, file_ids: e.target.checked ? [...draft.file_ids, f.id] : draft.file_ids.filter((x) => x !== f.id) })} />
                    <span className="truncate">{f.subject ? `${f.subject[0].toUpperCase()}${f.subject.slice(1)} · ` : ""}{f.chapter ? `${f.chapter} · ` : ""}{f.display_name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <label className="block text-sm font-semibold text-slate-700">Short note (optional)
            <input value={draft.note} maxLength={1000} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="input mt-1" />
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-60">{busy ? "Saving…" : "Save day"}</button>
            <button type="button" onClick={() => setDraft(null)} className="btn-light !px-4 !py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {days === null ? (
        <p className="text-sm text-slate-500">Loading study plan…</p>
      ) : days.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500 ring-1 ring-slate-200">No days yet.</p>
      ) : (
        <ol className="space-y-2">
          {days.map((d, i) => (
            <li key={d.id} className={`flex flex-wrap items-start gap-3 rounded-xl p-3 ring-1 ${d.is_sample ? "bg-amber-50 ring-amber-200" : "bg-white ring-slate-200"}`}>
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-xs font-extrabold text-white">Day {d.day_number}</span>
              <div className="min-w-0 flex-1 text-sm">
                {d.is_sample && <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-800">SAMPLE — replace or delete</p>}
                <p className="font-semibold text-slate-900">{d.subjects.join(" · ") || "No subject"}</p>
                {d.topics.length > 0 && <p className="text-slate-600">{d.topics.join(" · ")}</p>}
                {d.file_ids.length > 0 && <p className="text-xs text-brand-700">📄 {d.file_ids.map(fileName).join(" · ")}</p>}
                {d.note && <p className="text-xs text-slate-500">{d.note}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => void move(i, i - 1)} disabled={i === 0} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label={`Move day ${d.day_number} up`}>↑</button>
                <button type="button" onClick={() => void move(i, i + 1)} disabled={i === days.length - 1} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label={`Move day ${d.day_number} down`}>↓</button>
                <button type="button" onClick={() => setDraft({ id: d.id, day_number: d.day_number, subjects: d.subjects, topics: d.topics.join("\n"), file_ids: d.file_ids, note: d.note ?? "" })} className="btn-light !px-2.5 !py-1 text-xs"><EditIcon className="h-3.5 w-3.5" /> Edit</button>
                <button type="button" onClick={() => void remove(d)} className="btn-light !px-2.5 !py-1 text-xs !text-red-600"><TrashIcon className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
