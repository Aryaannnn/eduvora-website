import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CalendarIcon, LockIcon, UserIcon } from "../Icons";

// ⚠️ FAKE SAMPLE numbers for the blurred background picture only.
//    They are NOT real VITEEE data and never come from the database.
const SAMPLE = {
  rank: "12,345",
  range: "10,000 – 15,000",
  rows: [
    { campus: "Sample Campus A", branch: "Sample Branch 1", chance: "High", color: "bg-emerald-100 text-emerald-800" },
    { campus: "Sample Campus B", branch: "Sample Branch 2", chance: "Moderate", color: "bg-amber-100 text-amber-800" },
    { campus: "Sample Campus C", branch: "Sample Branch 3", chance: "Low", color: "bg-rose-100 text-rose-700" },
  ],
};

const founderFirst = siteConfig.founder.name.split(" ")[0];

/** Shown instead of the predictor to anyone without paid counselling. */
export default function PredictorLocked({ loggedIn, returnTo = "/predictor" }: { loggedIn: boolean; returnTo?: string }) {
  return (
    <div className="grid overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-brand-900/10 ring-1 ring-slate-200">
      {/* Blurred SAMPLE result in the background */}
      <div className="pointer-events-none select-none p-6 blur-[6px] [grid-area:1/1] sm:p-8" aria-hidden>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Predicted rank</p>
            <p className="mt-2 text-5xl font-extrabold text-brand-700">{SAMPLE.rank}</p>
            <p className="mt-2 text-sm text-slate-600">Likely range {SAMPLE.range}</p>
            <div className="mx-auto mt-4 h-3 w-3/4 rounded-full bg-gradient-to-r from-rose-300 via-amber-300 to-emerald-400" />
          </div>
          <ul className="space-y-3">
            {SAMPLE.rows.map((r) => (
              <li key={r.campus} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <span>
                  <span className="block font-extrabold text-slate-900">{r.campus}</span>
                  <span className="text-sm text-slate-600">{r.branch}</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.color}`}>{r.chance} Chance</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Lock message (same grid cell as the picture, so the card grows to fit it) */}
      <div className="z-10 grid place-items-center bg-gradient-to-b from-white/70 via-white/85 to-white/95 px-5 py-10 [grid-area:1/1] sm:py-12">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-400 text-brand-950 shadow-lg shadow-accent-500/30">
            <LockIcon className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl">Unlock Your VITEEE Rank &amp; College Predictor</h2>
          <p className="mt-3 text-slate-600">
            Get your predicted rank, the VIT campus and branch you can get, and your admission chances. Available for students who book a counselling session with {founderFirst} Sir.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5 text-base">
              <CalendarIcon className="h-5 w-5" /> Book Counselling to Unlock
            </Link>
            {!loggedIn && (
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-light !px-6 !py-3.5">
                <UserIcon className="h-5 w-5" /> Login
              </Link>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">Picture above is a blurred SAMPLE, not real data.</p>
        </div>
      </div>
    </div>
  );
}
