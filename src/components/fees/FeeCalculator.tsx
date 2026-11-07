"use client";

// Fee calculator: rank (typed, from the predictor link, or the student's last
// prediction) + campus → likely fee category, yearly and 4-year tuition.
import Link from "next/link";
import { useMemo, useState } from "react";
import { COURSE_YEARS, estimateFee, FEE_NOTE, rupees, type Campus, type CampusFee } from "@/lib/fees-shared";
import { ExternalIcon, TargetIcon } from "../Icons";

export default function FeeCalculator({ campuses, fees, startRank, predicted }: { campuses: Campus[]; fees: CampusFee[]; startRank: number | null; predicted: { rank: number; min: number; max: number } | null }) {
  const withFees = campuses.filter((c) => fees.some((f) => f.campus === c.name));
  const [rankText, setRankText] = useState(startRank ? String(startRank) : "");
  const [campus, setCampus] = useState(withFees[0]?.name ?? "");
  const rank = Number(rankText.replace(/[,\s]/g, ""));
  const valid = Number.isInteger(rank) && rank >= 1 && rank <= 10_000_000;
  const est = useMemo(() => (valid && campus ? estimateFee(fees, campus, rank) : null), [fees, campus, rank, valid]);
  const c = campuses.find((x) => x.name === campus) ?? null;
  const allCampus = useMemo(() => (valid ? withFees.map((x) => ({ campus: x, est: estimateFee(fees, x.name, rank) })).filter((x) => x.est) : []), [withFees, fees, rank, valid]);

  if (withFees.length === 0) return <p className="card p-8 text-center text-slate-600">Fee information will be available soon.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form className="card space-y-5 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-lg font-extrabold text-slate-900">Your details</h2>
        <div>
          <label htmlFor="fc-rank" className="text-sm font-bold text-slate-800">Your VITEEE rank</label>
          <input id="fc-rank" inputMode="numeric" value={rankText} onChange={(e) => setRankText(e.target.value)} placeholder="e.g. 25000" className="input mt-1 text-lg font-bold" aria-describedby="fc-rank-help" />
          <p id="fc-rank-help" className="mt-1 text-xs text-slate-500">
            Don&apos;t know it yet? <Link href="/predictor" className="font-semibold text-brand-700 underline">Predict your rank from marks</Link>
          </p>
          {predicted && (
            <button type="button" onClick={() => setRankText(String(predicted.rank))} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
              <TargetIcon className="h-3.5 w-3.5" /> Use my predicted rank ({predicted.min.toLocaleString("en-IN")} – {predicted.max.toLocaleString("en-IN")})
            </button>
          )}
        </div>
        <div>
          <label htmlFor="fc-campus" className="text-sm font-bold text-slate-800">Campus</label>
          <select id="fc-campus" value={campus} onChange={(e) => setCampus(e.target.value)} className="input mt-1">
            {withFees.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
          </select>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          ⚠️ {FEE_NOTE}{" "}
          <a href="https://vit.ac.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">vit.ac.in <ExternalIcon className="h-3 w-3" /></a>
        </p>
      </form>

      <div className="space-y-4" aria-live="polite">
        {!valid ? (
          <div className="card grid h-full place-items-center p-8 text-center text-slate-500">Enter your rank to see your likely fee category and tuition.</div>
        ) : !est ? (
          <div className="card p-8 text-center text-slate-500">No fee data for {campus} yet.</div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="hero-bg p-5 text-white sm:p-6">
                <p className="text-sm font-semibold text-accent-300">{campus} · rank {rank.toLocaleString("en-IN")} · {est.year} fee data</p>
                <p className="mt-1 text-3xl font-extrabold">Fee Category {est.row.fee_category}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {est.aboveAll ? "Your rank is better than every band — the best (lowest) category is likely." : est.beyondAll ? "Your rank is beyond the listed bands — this is the highest category listed." : `Ranks ${est.row.rank_from.toLocaleString("en-IN")} – ${est.row.rank_to ? est.row.rank_to.toLocaleString("en-IN") : "and above"}`}
                </p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-5">
                  <p className="text-xs font-semibold text-slate-500">Tuition per year (estimate)</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{rupees(est.perYear)}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold text-slate-500">{COURSE_YEARS}-year tuition (estimate)</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{rupees(est.total)}</p>
                </div>
              </div>
              {c && (c.hostel_fee_min !== null || c.hostel_fee_max !== null) && (
                <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
                  🏠 Hostel (per year, separate): <strong>{rupees(c.hostel_fee_min)} – {rupees(c.hostel_fee_max)}</strong>
                </p>
              )}
              {(est.row.is_sample || c?.is_sample) && <p className="bg-red-600 px-5 py-2 text-center text-xs font-extrabold uppercase tracking-wide text-white">Sample data — not real fees</p>}
            </div>

            <div className="card p-5">
              <p className="text-sm font-bold text-slate-800">All fee categories at {campus} ({est.year})</p>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-1.5">Category</th><th className="py-1.5">Rank range</th><th className="py-1.5 text-right">Per year</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {est.bands.map((b) => (
                    <tr key={b.id} className={b.id === est.row.id ? "bg-brand-50 font-bold text-brand-900" : "text-slate-700"}>
                      <td className="py-2 pl-1">Category {b.fee_category}{b.id === est.row.id && " ← you"}</td>
                      <td className="py-2">{b.rank_from.toLocaleString("en-IN")} – {b.rank_to ? b.rank_to.toLocaleString("en-IN") : "above"}</td>
                      <td className="py-2 pr-1 text-right">{rupees(b.tuition_per_year)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {allCampus.length > 1 && (
              <div className="card p-5">
                <p className="text-sm font-bold text-slate-800">Your rank at every campus</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {allCampus.map(({ campus: x, est: e }) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => setCampus(x.name)} className={`w-full rounded-xl p-3 text-left text-sm ring-1 transition ${x.name === campus ? "bg-brand-50 ring-brand-300" : "bg-white ring-slate-200 hover:bg-slate-50"}`}>
                        <span className="block font-bold text-slate-900">{x.name}</span>
                        <span className="text-slate-600">Category {e!.row.fee_category} · {rupees(e!.perYear)}/yr</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
