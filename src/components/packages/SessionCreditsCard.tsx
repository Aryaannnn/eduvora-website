import Link from "next/link";
import type { Credits } from "@/lib/packages";
import { CalendarIcon } from "../Icons";

/** "Sessions left: 2 of 3" card for students who bought a counselling package. */
export default function SessionCreditsCard({ credits }: { credits: Credits | null }) {
  if (!credits || (!credits.unlimited && credits.total <= 0 && credits.used <= 0)) return null;
  const pct = credits.unlimited || credits.total === 0 ? 100 : Math.round((credits.remaining / credits.total) * 100);
  const canBook = credits.unlimited || credits.remaining > 0;

  return (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-400 text-brand-950"><CalendarIcon className="h-6 w-6" /></span>
        <div>
          <p className="text-sm font-semibold text-slate-500">Counselling package</p>
          <p className="text-xl font-extrabold text-slate-900">
            {credits.unlimited ? "Unlimited sessions" : `Sessions left: ${credits.remaining} of ${credits.total}`}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {credits.unlimited ? `Until admission · ${credits.used} booked so far` : canBook ? "Book any open slot — no payment needed." : "All sessions used. Buy another package or pay for a single slot."}
          </p>
          {!credits.unlimited && credits.total > 0 && (
            <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>
      <Link href={canBook ? "/book-a-slot#book" : "/book-a-slot#packages"} className={canBook ? "btn-accent shrink-0" : "btn-light shrink-0"}>
        {canBook ? "Book a Session" : "See Packages"}
      </Link>
    </section>
  );
}
