import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CalendarIcon, CheckIcon, LockIcon, UserIcon } from "../Icons";

// ⚠️ FAKE SAMPLE rows for the blurred background picture only.
//    They are NOT real VITEEE data and never come from the database.
const SAMPLE_ROWS = [
  { campus: "Sample Campus A", branch: "Sample Branch 1", fee: "Category 1", rank: "00,000", chance: "High", color: "bg-emerald-100 text-emerald-800", row: "border-l-emerald-500" },
  { campus: "Sample Campus A", branch: "Sample Branch 2", fee: "Category 2", rank: "00,000", chance: "High", color: "bg-emerald-100 text-emerald-800", row: "border-l-emerald-500" },
  { campus: "Sample Campus B", branch: "Sample Branch 3", fee: "Category 3", rank: "00,000", chance: "Moderate", color: "bg-amber-100 text-amber-800", row: "border-l-amber-400" },
  { campus: "Sample Campus C", branch: "Sample Branch 4", fee: "Category 4", rank: "00,000", chance: "Moderate", color: "bg-amber-100 text-amber-800", row: "border-l-amber-400" },
  { campus: "Sample Campus D", branch: "Sample Branch 5", fee: "Category 5", rank: "00,000", chance: "Low", color: "bg-rose-100 text-rose-700", row: "border-l-rose-500" },
];

const founderFirst = siteConfig.founder.name.split(" ")[0];
const PERKS = ["Every VIT campus & branch you can get", "High / Moderate / Low chance for each", "Fee categories & filters", "Download as PDF"];

/**
 * The LOCKED part of the predictor: the college & branch list.
 * Shown (blurred, with fake sample rows) to everyone without paid counselling.
 * The real list is only ever sent by the server to students with full access.
 */
export default function LockedColleges({ loggedIn, returnTo = "/predictor" }: { loggedIn: boolean; returnTo?: string }) {
  return (
    <section className="grid overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-brand-900/10 ring-1 ring-slate-200 print:hidden" aria-labelledby="locked-colleges-title">
      {/* Blurred SAMPLE table in the background */}
      <div className="pointer-events-none select-none p-5 blur-[5px] [grid-area:1/1] sm:p-6" aria-hidden>
        <p className="text-lg font-extrabold text-slate-900">Your campus &amp; branch options</p>
        <p className="text-sm text-slate-500">12 option(s) · best chances first</p>
        <table className="mt-4 w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {SAMPLE_ROWS.map((r) => (
              <tr key={r.branch} className={`border-l-4 ${r.row}`}>
                <td className="px-3 py-3 font-semibold text-slate-900">{r.campus}</td>
                <td className="hidden px-3 py-3 text-slate-700 sm:table-cell">{r.branch}</td>
                <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{r.fee}</td>
                <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{r.rank}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${r.color}`}>{r.chance} Chance</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lock message (same grid cell as the picture, so the card grows to fit it) */}
      <div className="z-10 grid place-items-center bg-gradient-to-b from-white/60 via-white/85 to-white/95 px-5 py-10 [grid-area:1/1] sm:py-12">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-400 text-brand-950 shadow-lg shadow-accent-500/30">
            <LockIcon className="h-7 w-7" />
          </span>
          <h2 id="locked-colleges-title" className="mt-4 text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl">Which VIT college can you get?</h2>
          <p className="mt-2 text-slate-600">
            Your full college &amp; branch list is included when you book a counselling session with {founderFirst} Sir.
          </p>
          <ul className="mx-auto mt-4 grid max-w-md gap-1.5 text-left text-sm text-slate-700 sm:grid-cols-2">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-1.5"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5 text-base">
              <CalendarIcon className="h-5 w-5" /> Book Counselling to See Your Colleges
            </Link>
            {!loggedIn && (
              <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="btn-light !px-6 !py-3.5">
                <UserIcon className="h-5 w-5" /> Log In
              </Link>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">The list behind is a blurred SAMPLE, not real data.</p>
        </div>
      </div>
    </section>
  );
}
