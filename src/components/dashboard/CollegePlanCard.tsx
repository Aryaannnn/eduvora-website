import { PLAN_DISCLAIMER, type CollegePlan } from "@/lib/college-plan";
import { formatDateTime } from "@/lib/format";
import { CheckIcon, DownloadIcon } from "../Icons";

// Dashboard → My Bookings → "Your college plan" (published plans only).
export default function CollegePlanCard({ plan }: { plan: CollegePlan }) {
  const list = (title: string, items: string[], numbered: boolean) =>
    items.length > 0 && (
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {numbered ? (
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">{items.map((x, i) => <li key={i} className="rounded-full bg-white px-2.5 py-1 text-sm text-slate-700 ring-1 ring-slate-200">{x}</li>)}</ul>
        )}
      </div>
    );
  return (
    <section id={`plan-${plan.id}`} className="mt-4 scroll-mt-24 rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-100 sm:p-5" aria-label="Your college plan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-brand-800">
          📋 Your college plan
          {!plan.seen_at && <span className="rounded-full bg-accent-400 px-2.5 py-0.5 text-xs font-extrabold text-brand-950">New</span>}
        </h3>
        <a href={`/api/plans/${plan.id}/pdf`} className="btn-primary !px-4 !py-2 text-sm"><DownloadIcon className="h-4 w-4" /> Download PDF</a>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        By {plan.counsellor_name || "the EDUVORA team"}{plan.published_at ? ` · ${formatDateTime(plan.published_at)}` : ""}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {list("Recommended campuses (in order)", plan.campuses, true)}
        {list("Recommended branches", plan.branches, false)}
        {plan.fee_category && (
          <div>
            <p className="text-sm font-bold text-slate-900">Expected fee category</p>
            <p className="mt-1.5 text-sm text-slate-700">{plan.fee_category}</p>
          </div>
        )}
        {list("Choice-filling order", plan.choice_order, true)}
      </div>
      {plan.next_steps.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-900">Next steps</p>
          <ul className="mt-1.5 space-y-1.5">
            {plan.next_steps.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{x}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">{plan.notes}</p>}
      <p className="mt-4 text-xs text-slate-500">{PLAN_DISCLAIMER}</p>
    </section>
  );
}
