import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABEL, getImportantDates, getSiteUpdates } from "@/lib/important-dates";
import { countdown, dateRange, EmptyDates, OFFICIAL_NOTE, OfficialLink, STATUS_STYLE, StatusBadge } from "@/components/dates/DateBits";
import { CalendarIcon, ExternalIcon, MegaphoneIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { formatDayIST } from "@/lib/format";

export const metadata: Metadata = {
  title: "Important Dates & Updates",
  description: "VITEEE application, exam, result, counselling and fee payment dates in one timeline, plus the latest updates from EDUVORA.",
};

// ✏️ Edit events and updates in Admin → Important Dates.
export default async function ImportantDatesPage() {
  const [dates, updates] = await Promise.all([getImportantDates(), getSiteUpdates()]);
  const counts = { upcoming: 0, ongoing: 0, completed: 0 };
  for (const d of dates) counts[d.status]++;

  return (
    <>
      <PageHero eyebrow="Stay on time" title="Important Dates & Updates" subtitle="Applications, exam, results, counselling phases and fee deadlines — in one simple timeline.">
        <div className="mt-6 flex flex-wrap gap-2">
          {(["ongoing", "upcoming", "completed"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/15">
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} /> {counts[s]} {STATUS_STYLE[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </PageHero>

      <section className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.5fr_1fr]">
        {/* ---------- Timeline ---------- */}
        <div>
          <p className="mb-6 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
            <span aria-hidden>⚠️</span>
            <span>
              {OFFICIAL_NOTE}{" "}
              <a href="https://vit.ac.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">vit.ac.in <ExternalIcon className="h-3 w-3" /></a>
            </span>
          </p>

          {dates.length === 0 ? (
            <EmptyDates />
          ) : (
            <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6 sm:pl-8">
              {dates.map((d, i) => (
                <li key={d.id} id={`event-${d.id}`} className="relative scroll-mt-28">
                <Reveal delay={Math.min(i, 6) * 60}>
                  <span className={`absolute -left-[33px] top-6 grid h-5 w-5 place-items-center rounded-full ring-4 ring-white sm:-left-[41px] ${STATUS_STYLE[d.status].dot}`} aria-hidden />
                  <article className={`card p-5 sm:p-6 ${d.status === "ongoing" ? "ring-2 ring-emerald-300" : ""} ${d.status === "completed" ? "opacity-75" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700"><CalendarIcon className="h-3.5 w-3.5" /> {dateRange(d)}</span>
                      <StatusBadge status={d.status} />
                    </div>
                    <h2 className="mt-3 text-lg font-extrabold text-slate-900 sm:text-xl">{d.title}</h2>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {CATEGORY_LABEL[d.category]}{countdown(d) && <span className="ml-2 normal-case tracking-normal text-accent-700">· {countdown(d)}</span>}
                    </p>
                    {d.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{d.description}</p>}
                    {d.is_sample && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200">SAMPLE event — not a real date.</p>}
                    {d.official_link && <div className="mt-3"><OfficialLink href={d.official_link} /></div>}
                  </article>
                </Reveal>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ---------- Latest updates ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-400 text-brand-950"><MegaphoneIcon className="h-5 w-5" /></span>
              Latest Updates
            </h2>
            {updates.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">News and announcements will appear here.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {updates.map((u) => (
                  <li key={u.id} className="py-4 first:pt-0 last:pb-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {u.is_pinned && <span className="rounded-full bg-accent-100 px-2 py-0.5 font-bold text-accent-800">📌 Pinned</span>}
                      {formatDayIST(u.published_at)}
                    </p>
                    <p className="mt-1 font-bold text-slate-900">{u.title}</p>
                    {u.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{u.body}</p>}
                    {u.link && (
                      <a href={u.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                        Read more <ExternalIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-5 rounded-2xl bg-brand-700 p-5 text-white">
            <p className="font-extrabold">Confused about a deadline?</p>
            <p className="mt-1 text-sm text-slate-300">Book a counselling session and we&apos;ll plan every step with you.</p>
            <Link href="/book-a-slot" className="btn-accent mt-4 w-full">Book Counselling</Link>
          </div>
        </aside>
      </section>
    </>
  );
}
