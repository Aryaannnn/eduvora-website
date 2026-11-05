"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  bulkBands,
  bulkCutoffs,
  deleteBand,
  deleteCutoff,
  deleteSampleData,
  saveBand,
  saveCutoff,
  savePredictorSettings,
  type BandInput,
  type CutoffInput,
} from "@/app/admin/predictor-actions";
import { csvToObjects } from "@/lib/csv";
import { csvDateTimeIST, formatDateTime, todayInIndia } from "@/lib/format";
import { predictFromMarks } from "@/lib/predictor";
import { DownloadIcon, EditIcon, PhoneIcon, PlusIcon, SearchIcon, TrashIcon, UploadIcon, WhatsAppIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, downloadCsv } from "./ui";

export type AdminBand = { id: string; year: number; min_marks: number; max_marks: number; min_rank: number; max_rank: number; is_sample: boolean };
export type AdminCutoff = { id: string; year: number; campus: string; branch: string; fee_category: number; counselling_phase: number; closing_rank: number; is_sample: boolean };
export type AdminPrediction = {
  id: string; user_id: string; marks: number | null; entered_rank: number | null; predicted_min_rank: number; predicted_max_rank: number;
  preferred_campus: string | null; preferred_branch: string | null; created_at: string; name: string; email: string; phone: string;
};
type Result = { ok: boolean; error?: string; message?: string };
type Msg = { kind: "error" | "success"; text: string } | null;

const CAMPUSES = ["VIT Vellore", "VIT Chennai", "VIT-AP", "VIT Bhopal"];
const TABS = [
  { id: "leads", label: "Student leads" },
  { id: "bands", label: "Marks → Rank" },
  { id: "cutoffs", label: "College cutoffs" },
  { id: "settings", label: "Settings" },
] as const;
const fmt = (n: number) => Number(n).toLocaleString("en-IN");
const dayIST = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
const intlPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function PredictorAdmin({ settings, bands, cutoffs, predictions }: { settings: { active_year: number; disclaimer_text: string }; bands: AdminBand[]; cutoffs: AdminCutoff[]; predictions: AdminPrediction[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("leads");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const years = useMemo(() => [...new Set([settings.active_year, ...bands.map((b) => b.year), ...cutoffs.map((c) => c.year)])].sort((a, b) => b - a), [settings.active_year, bands, cutoffs]);
  const sampleCount = bands.filter((b) => b.is_sample).length + cutoffs.filter((c) => c.is_sample).length;

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) { after?.(); router.refresh(); }
    });

  return (
    <>
      <AdminHeader title="Rank & College Predictor" subtitle={`Active year: ${settings.active_year}. Changes show on the website immediately.`} />

      {sampleCount > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>⚠️ {sampleCount} SAMPLE rows</strong> are in use. They are NOT real VITEEE data — replace them before going live.</p>
          <button type="button" onClick={() => confirm("Delete ALL sample rank data and cutoffs? The predictor will be empty until you upload real data.") && run(deleteSampleData)} className="btn-light shrink-0 !px-3 !py-2 text-xs !text-red-600">
            <TrashIcon /> Delete all sample data
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Predictor sections" className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setMsg(null); }}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${tab === t.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200 hover:text-slate-900"}`}>
            {t.label}{t.id === "leads" ? ` (${predictions.length})` : ""}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 whitespace-pre-line"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={pending ? "pointer-events-none opacity-60" : ""}>
        {tab === "leads" && <Leads predictions={predictions} />}
        {tab === "bands" && <Bands bands={bands} years={years} activeYear={settings.active_year} run={run} setMsg={setMsg} />}
        {tab === "cutoffs" && <Cutoffs cutoffs={cutoffs} years={years} activeYear={settings.active_year} run={run} setMsg={setMsg} />}
        {tab === "settings" && <Settings settings={settings} years={years} run={run} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- LEADS
function Leads({ predictions }: { predictions: AdminPrediction[] }) {
  const [q, setQ] = useState("");
  const [campus, setCampus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [latestOnly, setLatestOnly] = useState(true);

  const shown = useMemo(() => {
    const seen = new Set<string>();
    return predictions.filter((p) => {
      const d = dayIST(p.created_at);
      const ok =
        (!q || `${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(q.toLowerCase())) &&
        (!campus || p.preferred_campus === campus) &&
        (!from || d >= from) &&
        (!to || d <= to);
      if (!ok) return false;
      if (latestOnly) {
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
      }
      return true;
    });
  }, [predictions, q, campus, from, to, latestOnly]);

  const exportCsv = () =>
    downloadCsv(
      `predictor-leads-${todayInIndia()}.csv`,
      ["Date", "Name", "Phone", "Email", "Marks", "Entered rank", "Predicted min rank", "Predicted max rank", "Preferred campus", "Preferred branch"],
      shown.map((p) => [csvDateTimeIST(p.created_at), p.name, p.phone, p.email, p.marks, p.entered_rank, p.predicted_min_rank, p.predicted_max_rank, p.preferred_campus, p.preferred_branch]),
    );

  return (
    <>
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email…" className="input !pl-9" aria-label="Search leads" />
        </div>
        <select value={campus} onChange={(e) => setCampus(e.target.value)} className="input" aria-label="Preferred campus">
          <option value="">Any preferred campus</option>
          {CAMPUSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Show only each student&apos;s latest prediction
        </label>
        <button type="button" onClick={exportCsv} className="btn-light !py-2"><DownloadIcon /> Export CSV ({shown.length})</button>
      </div>

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No predictions yet. They appear here when logged-in students use the predictor.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Marks / rank</th><th className="px-4 py-3">Predicted rank</th><th className="px-4 py-3">Preference</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Follow up</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => {
                const phone = p.phone ? intlPhone(p.phone) : "";
                const wa = phone
                  ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${p.name || "there"}, I saw your VITEEE rank prediction (~${fmt(p.predicted_min_rank)}). Would you like a counselling call to plan your campus and branch choices?`)}`
                  : "";
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{p.name || "—"}</p>
                      <p className="text-xs text-slate-500">{p.email}{p.phone && ` · +${p.phone}`}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.marks !== null ? `${+p.marks} marks` : `Rank ${fmt(p.entered_rank ?? p.predicted_min_rank)}`}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">
                      {p.predicted_min_rank === p.predicted_max_rank ? fmt(p.predicted_min_rank) : `${fmt(p.predicted_min_rank)} – ${fmt(p.predicted_max_rank)}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{[p.preferred_campus, p.preferred_branch].filter(Boolean).join(" · ") || "Any"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(p.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {phone ? (
                        <span className="inline-flex gap-2">
                          <a href={`tel:+${phone}`} className="btn-primary !px-3 !py-1.5 text-xs"><PhoneIcon className="h-3.5 w-3.5" /> Call</a>
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary !bg-[#25D366] !px-3 !py-1.5 text-xs"><WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp</a>
                        </span>
                      ) : p.email ? (
                        <a href={`mailto:${p.email}`} className="btn-light !px-3 !py-1.5 text-xs">Email</a>
                      ) : <span className="text-xs text-slate-400">No contact</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Call/WhatsApp use the phone number from the student&apos;s profile. Students without a phone show an Email button.</p>
    </>
  );
}

// ---------------------------------------------------------------- CSV upload box (shared)
function CsvUpload<T>({ label, sampleHref, required, map, onUpload }: {
  label: string; sampleHref: string; required: string[];
  map: (row: Record<string, string>) => T; onUpload: (rows: T[], replace: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<T[] | null>(null);
  const [replace, setReplace] = useState(true);
  const [error, setError] = useState("");

  async function read(file: File) {
    setError("");
    setRows(null);
    try {
      setRows(csvToObjects(await file.text(), required).map(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="card mb-4 border-2 border-dashed border-slate-200 p-4">
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">Columns: {required.join(", ")}</p>
        </div>
        <div className="flex gap-2">
          <a href={sampleHref} download className="btn-light !px-3 !py-2 text-sm"><DownloadIcon /> Sample CSV</a>
          <button type="button" onClick={() => input.current?.click()} className="btn-light !px-3 !py-2 text-sm"><UploadIcon /> Choose CSV</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {rows && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
          <div className="text-sm text-brand-900">
            <p><strong>{rows.length}</strong> row(s) ready.</p>
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-brand-600" />
              Replace existing rows for the same year(s) (recommended for a full upload)
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRows(null)} className="btn-light !px-3 !py-1.5 text-xs">Cancel</button>
            <button type="button" onClick={() => { onUpload(rows, replace); setRows(null); }} className="btn-primary !px-3 !py-1.5 text-xs">Upload {rows.length} rows</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- MARKS → RANK
function Bands({ bands, years, activeYear, run, setMsg }: { bands: AdminBand[]; years: number[]; activeYear: number; run: (fn: () => Promise<Result>, after?: () => void) => void; setMsg: (m: Msg) => void }) {
  const [year, setYear] = useState(activeYear);
  const [editing, setEditing] = useState<AdminBand | "new" | null>(null);
  const [testMarks, setTestMarks] = useState("90");
  const list = bands.filter((b) => b.year === year);
  const test = predictFromMarks(Number(testMarks), list);

  // Spot gaps / overlaps between bands for this year
  const sorted = [...list].sort((a, b) => a.min_marks - b.min_marks);
  const warnings: string[] = [];
  sorted.forEach((b, i) => {
    const next = sorted[i + 1];
    if (next && next.min_marks < b.max_marks) warnings.push(`${b.min_marks}–${b.max_marks} overlaps ${next.min_marks}–${next.max_marks}`);
    if (next && next.min_marks > b.max_marks) warnings.push(`gap between ${b.max_marks} and ${next.min_marks} marks (filled smoothly)`);
    if (next && next.max_rank > b.min_rank) warnings.push(`ranks at ${b.max_marks}/${next.min_marks} marks don't line up`);
  });

  return (
    <>
      <CsvUpload<BandInput>
        label="Bulk upload marks → rank (CSV)"
        sampleHref="/sample-rank-data.csv"
        required={["year", "min_marks", "max_marks", "min_rank", "max_rank"]}
        map={(r) => ({ year: r.year, min_marks: r.min_marks, max_marks: r.max_marks, min_rank: r.min_rank, max_rank: r.max_rank })}
        onUpload={(rows, replace) => run(() => bulkBands(rows, replace))}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto">
            {years.map((y) => <option key={y} value={y}>{y}{y === activeYear ? " (active)" : ""}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setMsg(null); setEditing("new"); }} className="btn-primary !py-2"><PlusIcon /> Add row</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-3">Marks</th><th className="px-4 py-3">Rank (best → worst)</th><th className="px-4 py-3" /><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No rows for {year}. Upload a CSV or add rows.</td></tr>}
              {list.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{+b.min_marks} – {+b.max_marks}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{fmt(b.min_rank)} → {fmt(b.max_rank)}</td>
                  <td className="px-4 py-3">{b.is_sample && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">SAMPLE</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(b)} className="btn-light !px-2.5 !py-1 text-xs" aria-label="Edit row"><EditIcon /></button>{" "}
                    <button type="button" onClick={() => confirm("Delete this row?") && run(() => deleteBand(b.id))} className="btn-light !px-2.5 !py-1 text-xs !text-red-600" aria-label="Delete row"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card h-fit p-4">
          <p className="font-bold text-slate-900">Quick check</p>
          <p className="text-xs text-slate-500">Uses the same calculation as the website.</p>
          <label className="mt-3 block text-sm font-semibold text-slate-700" htmlFor="tm">Marks</label>
          <input id="tm" type="number" min={0} max={125} step={0.5} value={testMarks} onChange={(e) => setTestMarks(e.target.value)} className="input mt-1" />
          <p className="mt-3 text-sm text-slate-700">
            {test ? <>Predicted rank <strong>~{fmt(test.rank)}</strong><br /><span className="text-xs text-slate-500">range {fmt(test.minRank)} – {fmt(test.maxRank)}</span></> : "Add data for this year first."}
          </p>
          {warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-700">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </aside>
      </div>

      {editing && (
        <BandForm band={editing === "new" ? null : editing} year={year} onClose={() => setEditing(null)} onSubmit={(v) => run(() => saveBand(v), () => setEditing(null))} />
      )}
    </>
  );
}

function BandForm({ band, year, onClose, onSubmit }: { band: AdminBand | null; year: number; onClose: () => void; onSubmit: (v: BandInput) => void }) {
  const [v, setV] = useState({
    year: String(band?.year ?? year), min_marks: String(band?.min_marks ?? ""), max_marks: String(band?.max_marks ?? ""),
    min_rank: String(band?.min_rank ?? ""), max_rank: String(band?.max_rank ?? ""),
  });
  const field = (k: keyof typeof v, label: string, hint?: string) => (
    <div>
      <Label htmlFor={`bf-${k}`}>{label}</Label>
      <input id={`bf-${k}`} type="number" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" required step="any" />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return (
    <Modal title={band ? "Edit marks → rank row" : "Add marks → rank row"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: band?.id }); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("year", "Year")}</div>
        {field("min_marks", "Min marks")}
        {field("max_marks", "Max marks")}
        {field("min_rank", "Best rank", "Rank at MAX marks")}
        {field("max_rank", "Worst rank", "Rank at MIN marks")}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- CUTOFFS
function Cutoffs({ cutoffs, years, activeYear, run, setMsg }: { cutoffs: AdminCutoff[]; years: number[]; activeYear: number; run: (fn: () => Promise<Result>, after?: () => void) => void; setMsg: (m: Msg) => void }) {
  const [year, setYear] = useState(activeYear);
  const [campus, setCampus] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminCutoff | "new" | null>(null);
  const list = cutoffs.filter((c) => c.year === year && (!campus || c.campus === campus) && (!q || c.branch.toLowerCase().includes(q.toLowerCase())));
  const branches = useMemo(() => [...new Set(cutoffs.map((c) => c.branch))].sort(), [cutoffs]);

  return (
    <>
      <CsvUpload<CutoffInput>
        label="Bulk upload college cutoffs (CSV)"
        sampleHref="/sample-college-cutoffs.csv"
        required={["year", "campus", "branch", "fee_category", "closing_rank"]}
        map={(r) => ({ year: r.year, campus: r.campus, branch: r.branch, fee_category: r.fee_category, counselling_phase: r.counselling_phase ?? "", closing_rank: r.closing_rank })}
        onUpload={(rows, replace) => run(() => bulkCutoffs(rows, replace))}
      />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input" aria-label="Year">
          {years.map((y) => <option key={y} value={y}>{y}{y === activeYear ? " (active)" : ""}</option>)}
        </select>
        <select value={campus} onChange={(e) => setCampus(e.target.value)} className="input" aria-label="Campus">
          <option value="">All campuses</option>
          {CAMPUSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search branch…" className="input !pl-9" aria-label="Search branch" />
        </div>
        <button type="button" onClick={() => { setMsg(null); setEditing("new"); }} className="btn-primary"><PlusIcon /> Add cutoff</button>
      </div>

      <p className="mb-2 text-sm text-slate-600">{list.length} cutoff(s)</p>
      <div className="card max-h-[36rem] overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Campus</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Phase</th><th className="px-4 py-3">Closing rank</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No cutoffs match.</td></tr>}
            {list.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{c.campus}</td>
                <td className="px-4 py-2.5 text-slate-700">{c.branch} {c.is_sample && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">SAMPLE</span>}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.fee_category}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.counselling_phase}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-900">{fmt(c.closing_rank)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button type="button" onClick={() => setEditing(c)} className="btn-light !px-2.5 !py-1 text-xs" aria-label="Edit cutoff"><EditIcon /></button>{" "}
                  <button type="button" onClick={() => confirm(`Delete ${c.campus} ${c.branch} (category ${c.fee_category})?`) && run(() => deleteCutoff(c.id))} className="btn-light !px-2.5 !py-1 text-xs !text-red-600" aria-label="Delete cutoff"><TrashIcon /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CutoffForm cutoff={editing === "new" ? null : editing} year={year} branches={branches} onClose={() => setEditing(null)} onSubmit={(v) => run(() => saveCutoff(v), () => setEditing(null))} />
      )}
    </>
  );
}

function CutoffForm({ cutoff, year, branches, onClose, onSubmit }: { cutoff: AdminCutoff | null; year: number; branches: string[]; onClose: () => void; onSubmit: (v: CutoffInput) => void }) {
  const [v, setV] = useState({
    year: String(cutoff?.year ?? year), campus: cutoff?.campus ?? CAMPUSES[0], branch: cutoff?.branch ?? "",
    fee_category: String(cutoff?.fee_category ?? 1), counselling_phase: String(cutoff?.counselling_phase ?? 1), closing_rank: String(cutoff?.closing_rank ?? ""),
  });
  return (
    <Modal title={cutoff ? "Edit cutoff" : "Add cutoff"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: cutoff?.id }); }} className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="cf-year">Year</Label><input id="cf-year" type="number" value={v.year} onChange={(e) => setV({ ...v, year: e.target.value })} className="input" required /></div>
        <div>
          <Label htmlFor="cf-campus">Campus</Label>
          <select id="cf-campus" value={v.campus} onChange={(e) => setV({ ...v, campus: e.target.value })} className="input">{CAMPUSES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cf-branch">Branch</Label>
          <input id="cf-branch" list="cf-branches" value={v.branch} onChange={(e) => setV({ ...v, branch: e.target.value })} className="input" required placeholder="e.g. CSE with AI & ML" />
          <datalist id="cf-branches">{branches.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
        <div>
          <Label htmlFor="cf-cat">Fee category</Label>
          <select id="cf-cat" value={v.fee_category} onChange={(e) => setV({ ...v, fee_category: e.target.value })} className="input">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Category {n}</option>)}</select>
        </div>
        <div><Label htmlFor="cf-phase">Counselling phase</Label><input id="cf-phase" type="number" min={1} max={10} value={v.counselling_phase} onChange={(e) => setV({ ...v, counselling_phase: e.target.value })} className="input" required /></div>
        <div className="sm:col-span-2"><Label htmlFor="cf-rank">Closing rank</Label><input id="cf-rank" type="number" min={1} value={v.closing_rank} onChange={(e) => setV({ ...v, closing_rank: e.target.value })} className="input" required /></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- SETTINGS
function Settings({ settings, years, run }: { settings: { active_year: number; disclaimer_text: string }; years: number[]; run: (fn: () => Promise<Result>) => void }) {
  const [year, setYear] = useState(String(settings.active_year));
  const [text, setText] = useState(settings.disclaimer_text);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => savePredictorSettings({ active_year: year, disclaimer_text: text })); }} className="card max-w-2xl space-y-5 p-6">
      <div>
        <Label htmlFor="ps-year">Active year (the data the website uses)</Label>
        <input id="ps-year" list="ps-years" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="input !w-40" required />
        <datalist id="ps-years">{years.map((y) => <option key={y} value={y} />)}</datalist>
        <p className="mt-1 text-xs text-slate-500">Years with data: {years.join(", ") || "none yet"}. Upload a new year&apos;s data first, then switch to it here.</p>
      </div>
      <div>
        <Label htmlFor="ps-disc">Disclaimer text (shown under every prediction)</Label>
        <textarea id="ps-disc" rows={4} value={text} onChange={(e) => setText(e.target.value)} className="input" required />
      </div>
      <button type="submit" className="btn-primary">Save settings</button>
    </form>
  );
}
