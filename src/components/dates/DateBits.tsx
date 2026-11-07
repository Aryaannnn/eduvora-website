import Link from "next/link";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABEL, type DateStatus, type ImportantDate } from "@/lib/important-dates";
import { ArrowRightIcon, CalendarIcon, ExternalIcon } from "../Icons";

export const STATUS_STYLE: Record<DateStatus, { label: string; badge: string; dot: string }> = {
  upcoming: { label: "Upcoming", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  ongoing: { label: "Ongoing", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  completed: { label: "Completed", badge: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-300" },
};

export function StatusBadge({ status }: { status: DateStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${s.badge}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot} ${status === "ongoing" ? "animate-pulse" : ""}`} /> {s.label}
    </span>
  );
}

/** "Mon, 20 Apr 2026" or "20 Apr – 2 May 2026" */
export function dateRange(d: Pick<ImportantDate, "start_date" | "end_date">) {
  if (!d.end_date || d.end_date === d.start_date) return formatDate(d.start_date, true);
  return `${formatDate(d.start_date, d.start_date.slice(0, 4) !== d.end_date.slice(0, 4))} – ${formatDate(d.end_date, true)}`;
}

export function countdown(d: ImportantDate) {
  if (d.status === "ongoing") return "Happening now";
  if (d.status === "completed") return "";
  return d.daysToGo === 1 ? "Tomorrow" : `In ${d.daysToGo} days`;
}

export const OFFICIAL_NOTE = "Always confirm dates on the official VIT website.";

/** Compact "next 3 events" list for the home page and the student dashboard. */
export function NextDatesList({ dates, dark = false }: { dates: ImportantDate[]; dark?: boolean }) {
  if (dates.length === 0) return null;
  return (
    <ul className="space-y-3">
      {dates.map((d) => (
        <li key={d.id}>
          <Link href={`/important-dates#event-${d.id}`} className={`group flex items-center gap-4 rounded-2xl p-4 ring-1 transition ${dark ? "bg-white/5 ring-white/10 hover:bg-white/10" : "bg-white ring-slate-200 hover:ring-brand-300"}`}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-600 text-center leading-none text-white">
              <span>
                <span className="block text-lg font-extrabold">{+d.start_date.slice(8, 10)}</span>
                <span className="block text-[10px] font-bold uppercase">{formatDate(d.start_date).split(" ").pop()}</span>
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-bold ${dark ? "text-white" : "text-slate-900"}`}>{d.title}</span>
              <span className={`block text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}>{CATEGORY_LABEL[d.category]} · {dateRange(d)}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={d.status} />
                {countdown(d) && <span className={`text-xs font-semibold ${dark ? "text-accent-300" : "text-accent-700"}`}>{countdown(d)}</span>}
              </span>
            </span>
            <ArrowRightIcon className={`h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${dark ? "text-slate-300" : "text-slate-400"}`} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OfficialLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
      Official link <ExternalIcon className="h-3.5 w-3.5" />
    </a>
  );
}

export function EmptyDates() {
  return (
    <div className="card p-8 text-center">
      <CalendarIcon className="mx-auto h-10 w-10 text-brand-500" />
      <p className="mt-3 font-bold text-slate-900">Dates will be added soon</p>
      <p className="mt-1 text-sm text-slate-600">We add each date as soon as it is announced officially.</p>
    </div>
  );
}
