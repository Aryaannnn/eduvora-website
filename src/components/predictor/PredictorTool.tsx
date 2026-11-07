"use client";

// =====================================================================
//  PREDICTOR SCREEN (browser part)
//  It does NOT contain any rank or cutoff data. Every time the student
//  changes their marks, it asks the server (/api/predictor), which checks
//  access and sends back only the result:
//    guest -> nothing (asked to log in / sign up)
//    free  -> rank range only; the college list is a blurred FAKE sample
//    full  -> everything (paid counselling students and admins)
// =====================================================================
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { track } from "@/lib/analytics";
import { formatDateTime } from "@/lib/format";
import { CHANCE_LABEL, MAX_MARKS, type Chance, type CollegeMatch, type Prediction } from "@/lib/predictor";
import { CalendarIcon, DownloadIcon, LockIcon, TargetIcon, UserIcon } from "../Icons";
import LockedColleges from "./PredictorLocked";
import RankGauge, { tierFor } from "./RankGauge";

export type PredictorAccessLevel = "guest" | "free" | "full";

export type PastPrediction = {
  id: string; marks: number | null; entered_rank: number | null; predicted_min_rank: number; predicted_max_rank: number;
  preferred_campus: string | null; preferred_branch: string | null; created_at: string;
};

const chanceStyle: Record<Chance, { badge: string; dot: string; row: string }> = {
  high: { badge: "bg-emerald-100 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", row: "border-l-emerald-500" },
  moderate: { badge: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500", row: "border-l-amber-400" },
  low: { badge: "bg-rose-100 text-rose-700 ring-rose-200", dot: "bg-rose-500", row: "border-l-rose-500" },
};
const fmt = (n: number) => n.toLocaleString("en-IN");
const founderFirst = siteConfig.founder.name.split(" ")[0];

export function ChanceBadge({ chance }: { chance: Chance }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${chanceStyle[chance].badge}`}>
      <span className={`h-2 w-2 rounded-full ${chanceStyle[chance].dot}`} /> {CHANCE_LABEL[chance]}
    </span>
  );
}

export type PredictorOptions = {
  activeYear: number | null;
  disclaimer: string;
  isSample: boolean;
  hasData: boolean;
  campuses: string[];
  branchesByCampus: Record<string, string[]>;
};
// counts / total / matches are only sent by the server to users with FULL access
type Result = { prediction: Prediction | null; percentile: number; full: boolean; counts?: Record<Chance, number>; total?: number; matches?: CollegeMatch[] };

export default function PredictorTool({
  options,
  mode,
  access,
  returnTo = "/predictor",
  userName,
  initialHistory = [],
}: {
  options: PredictorOptions;
  mode: "public" | "dashboard";
  access: PredictorAccessLevel;
  returnTo?: string;
  userName?: string;
  initialHistory?: PastPrediction[];
}) {
  const [inputType, setInputType] = useState<"marks" | "rank">("marks");
  const [marks, setMarks] = useState(90);
  const [rankInput, setRankInput] = useState("");
  const [campus, setCampus] = useState("");
  const [branch, setBranch] = useState("");
  const [feeCategory, setFeeCategory] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("");
  const [history, setHistory] = useState(initialHistory);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [printedAt, setPrintedAt] = useState("");
  const lastSaved = useRef("");
  const usedOnce = useRef(false); // analytics: count one "predictor used" per visit

  const hasData = options.hasData;
  const full = access === "full";
  const guest = access === "guest";
  const branches = campus ? options.branchesByCampus[campus] ?? [] : [...new Set(Object.values(options.branchesByCampus).flat())].sort();
  const key = JSON.stringify({ inputType, marks, rank: Number(rankInput), campus, branch, feeCategory, full: full && mode === "dashboard" });
  const rankOk = inputType === "marks" || Number(rankInput) >= 1;

  // Ask the server for the result (a short pause first, so sliding stays smooth)
  useEffect(() => {
    if (guest || !hasData || !rankOk) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/predictor", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: ctrl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not calculate.");
        setResult(body as Result);
        if (!usedOnce.current) {
          usedOnce.current = true;
          track("predictor_used", { access, method: (JSON.parse(key) as { inputType: string }).inputType, page: mode });
        }
        setProblem("");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setProblem((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [key, hasData, rankOk, guest, access, mode]);

  // Logged-in students: save the prediction a moment after they stop changing it
  // (shows in "My Past Predictions" and in Admin -> Predictor as a lead)
  useEffect(() => {
    if (guest || !hasData || !rankOk || key === lastSaved.current) return;
    const id = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/predictor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(key), save: true }) });
        const body = await res.json();
        if (!res.ok || !body.saved) throw new Error("not saved");
        lastSaved.current = key;
        setSaveState("saved");
        setHistory((h) => [body.saved as PastPrediction, ...h].slice(0, 20));
      } catch {
        setSaveState("error");
      }
    }, 1800);
    return () => clearTimeout(id);
  }, [guest, key, hasData, rankOk]);

  const prediction = rankOk ? (result?.prediction ?? null) : null;
  const percentile = result?.percentile ?? 0;
  const tier = tierFor(percentile);
  const counts = result?.counts ?? { high: 0, moderate: 0, low: 0 };
  const filtered = result?.matches ?? [];

  function downloadPdf() {
    setPrintedAt(formatDateTime(new Date()));
    setTimeout(() => window.print(), 50); // choose "Save as PDF" in the print window
  }

  if (!hasData) {
    return (
      <div className="card p-8 text-center">
        <TargetIcon className="mx-auto h-10 w-10 text-brand-500" />
        <p className="mt-3 text-lg font-bold text-slate-900">The predictor is being updated</p>
        <p className="mt-1 text-slate-600">Rank data for this year will be available soon. Meanwhile, talk to our counsellor.</p>
        <Link href="/book-a-slot" className="btn-primary mt-5">Book Counselling with {founderFirst} Sir</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Print-only header for the PDF */}
      <div className="hidden print:block">
        <p className="text-2xl font-extrabold">{siteConfig.businessName} — VITEEE Rank &amp; College Prediction</p>
        <p className="text-sm">{userName ? `Student: ${userName} · ` : ""}{printedAt} · Data year {options.activeYear}</p>
      </div>

      <div className="card overflow-hidden print:shadow-none">
        <div className="grid lg:grid-cols-[1fr_1.1fr]">
          {/* ---------- Inputs ---------- */}
          <div className="border-b border-slate-100 p-5 sm:p-7 lg:border-b-0 lg:border-r print:hidden">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Your score</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {options.activeYear} data{options.isSample && " · SAMPLE"}
              </span>
            </div>

            <div role="tablist" aria-label="What do you know?" className="mt-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5">
              {(["marks", "rank"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={inputType === t} onClick={() => setInputType(t)}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${inputType === t ? "bg-white text-brand-700 shadow" : "text-slate-600 hover:text-slate-900"}`}>
                  {t === "marks" ? "I know my marks" : "I know my rank"}
                </button>
              ))}
            </div>

            {inputType === "marks" ? (
              <div className="mt-6 animate-fade-up">
                <label htmlFor="pred-marks" className="text-sm font-semibold text-slate-700">Expected marks (out of {MAX_MARKS})</label>
                <div className="mt-3 flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={MAX_MARKS}
                    step={0.5}
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className="h-3 flex-1 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-300 accent-brand-600"
                    aria-label="Expected marks slider"
                  />
                  <input
                    id="pred-marks"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={MAX_MARKS}
                    step={0.5}
                    value={marks}
                    onChange={(e) => setMarks(Math.min(MAX_MARKS, Math.max(0, Number(e.target.value) || 0)))}
                    className="input !w-24 text-center !text-xl font-extrabold"
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400"><span>0</span><span>{MAX_MARKS / 2}</span><span>{MAX_MARKS}</span></div>
              </div>
            ) : (
              <div className="mt-6 animate-fade-up">
                <label htmlFor="pred-rank" className="text-sm font-semibold text-slate-700">Your VITEEE rank</label>
                <input id="pred-rank" type="number" inputMode="numeric" min={1} value={rankInput} onChange={(e) => setRankInput(e.target.value.replace(/\D/g, ""))}
                  className="input mt-2 !text-xl font-extrabold" placeholder="e.g. 12500" />
              </div>
            )}

            {mode === "dashboard" && full && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <select value={campus} onChange={(e) => { setCampus(e.target.value); setBranch(""); }} className="input" aria-label="Preferred campus">
                  <option value="">All campuses</option>
                  {options.campuses.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className="input" aria-label="Preferred branch">
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b}>{b}</option>)}
                </select>
                <select value={feeCategory} onChange={(e) => setFeeCategory(Number(e.target.value))} className="input" aria-label="Fee category">
                  <option value={0}>All fee categories</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Category {n}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* ---------- Result ---------- */}
          <div className={`bg-gradient-to-br from-slate-50 to-white p-5 transition-opacity sm:p-7 ${loading ? "opacity-70" : ""}`} aria-busy={loading}>
            {guest ? (
              <div className="animate-fade-up py-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <LockIcon className="h-7 w-7" />
                </span>
                <p className="mt-4 text-lg font-extrabold text-slate-900">See your predicted VITEEE rank</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">Log in or sign up free to see your likely rank range for these {inputType === "marks" ? "marks" : "details"}.</p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href={`/login?mode=signup&next=${encodeURIComponent(returnTo)}`} className="btn-primary !px-5 !py-3">Sign Up Free</Link>
                  <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-light !px-5 !py-3"><UserIcon className="h-4 w-4" /> Log In</Link>
                </div>
              </div>
            ) : prediction ? (
              <div key={`${prediction.minRank}-${prediction.maxRank}`} className="animate-fade-up text-center">
                <RankGauge rank={prediction.rank} percentile={percentile} />
                <p className="mt-3 text-sm text-slate-600">
                  {prediction.source === "marks" ? <>Likely range <strong className="text-slate-900">{fmt(prediction.minRank)} – {fmt(prediction.maxRank)}</strong></> : <>Your rank <strong className="text-slate-900">{fmt(prediction.rank)}</strong></>}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${tier.bg} ${tier.text}`}>{tier.label}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">Better than {percentile}% of students</span>
                </div>
                {prediction.coverage !== "ok" && (
                  <p className="mt-3 text-xs text-amber-700">Your marks are {prediction.coverage === "above" ? "above" : "below"} our data range, so this is the closest estimate.</p>
                )}
                {full ? (
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {(["high", "moderate", "low"] as const).map((c) => (
                      <div key={c} className={`rounded-xl p-2 ring-1 ${chanceStyle[c].badge}`}>
                        <p className="text-xl font-extrabold">{counts[c]}</p>
                        <p className="text-[11px] font-semibold">{CHANCE_LABEL[c].replace(" Chance", "")}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  mode === "dashboard" && <SaveNote state={saveState} className="mt-4" />
                )}
              </div>
            ) : (
              <p className="py-16 text-center text-slate-500">{problem || (loading ? "Calculating…" : `Enter your ${inputType === "marks" ? "marks" : "rank"} to see your prediction.`)}</p>
            )}
          </div>
        </div>
      </div>

      {!full && <LockedColleges loggedIn={!guest} returnTo={returnTo} />}

      {full && prediction && mode === "public" && (
        <PublicPreview preview={filtered} total={result?.total ?? 0} />
      )}

      {full && prediction && mode === "dashboard" && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Your campus &amp; branch options</h2>
              <p className="text-sm text-slate-500">{filtered.length} option(s) · best chances first</p>
            </div>
            <SaveNote state={saveState} />
          </div>
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No options match these filters.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto print:max-h-none">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-4 py-3">Campus</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Fee category</th><th className="px-4 py-3">Closing rank</th><th className="px-4 py-3">Your chance</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => (
                    <tr key={`${m.campus}-${m.branch}-${m.fee_category}-${m.counselling_phase}`} className={`border-l-4 ${chanceStyle[m.chance].row}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.campus}</td>
                      <td className="px-4 py-3 text-slate-700">{m.branch}</td>
                      <td className="px-4 py-3 text-slate-600">Category {m.fee_category}{m.counselling_phase > 1 && <span className="text-xs text-slate-400"> · phase {m.counselling_phase}</span>}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{fmt(m.closing_rank)}</td>
                      <td className="px-4 py-3"><ChanceBadge chance={m.chance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Disclaimer */}
      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <span aria-hidden>⚠️</span> <span><strong>Disclaimer:</strong> {options.disclaimer}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <Link href="/book-a-slot" className="btn-primary !py-3.5 text-base"><CalendarIcon className="h-5 w-5" /> Book Counselling with {founderFirst} Sir</Link>
        {full && mode === "dashboard" && prediction && (
          <button type="button" onClick={downloadPdf} className="btn-light !py-3.5"><DownloadIcon /> Download my result as PDF</button>
        )}
      </div>

      {mode === "dashboard" && (
        <section className="card p-5 print:hidden">
          <h2 className="text-lg font-extrabold text-slate-900">My Past Predictions</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Your predictions are saved here automatically.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {h.marks !== null ? `${+h.marks} marks` : `Rank ${fmt(h.entered_rank ?? h.predicted_min_rank)}`} →{" "}
                      {h.predicted_min_rank === h.predicted_max_rank ? fmt(h.predicted_min_rank) : `${fmt(h.predicted_min_rank)} – ${fmt(h.predicted_max_rank)}`}
                    </p>
                    <p className="text-xs text-slate-500">{[h.preferred_campus, h.preferred_branch].filter(Boolean).join(" · ") || "All campuses & branches"}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function SaveNote({ state, className = "" }: { state: "idle" | "saving" | "saved" | "error"; className?: string }) {
  return (
    <p className={`text-xs text-slate-500 print:hidden ${className}`} aria-live="polite">
      {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved to My Past Predictions" : state === "error" ? "Couldn't save — check your connection" : ""}
    </p>
  );
}

// Best 3 matches + a link to the full list in the dashboard
function PublicPreview({ preview, total }: { preview: CollegeMatch[]; total: number }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Colleges you could get</h2>
      <p className="text-sm text-slate-500">Your best matches.</p>
      {preview.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No matching options in our data for this rank. Talk to us, there may still be good choices.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {preview.map((m, i) => (
            <li key={`${m.campus}-${m.branch}`} style={{ animationDelay: `${i * 90}ms` }} className="animate-fade-up rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="font-extrabold text-slate-900">{m.campus}</p>
              <p className="text-sm text-slate-700">{m.branch}</p>
              <p className="mt-1 text-xs text-slate-500">Fee category {m.fee_category} · closing rank {fmt(m.closing_rank)}</p>
              <div className="mt-3"><ChanceBadge chance={m.chance} /></div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/predictor" className="btn-primary mt-5 !py-2.5">See all {total} campus &amp; branch options in my dashboard</Link>
    </section>
  );
}
