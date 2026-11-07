import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarIcon, CheckIcon, LockIcon, TargetIcon } from "@/components/Icons";
import { LineChart } from "@/components/tests/Charts";
import { siteConfig } from "@/config/site";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { getPublicSupabase } from "@/lib/supabase/public";

// Private parent page: never indexed, never cached, no referrer (see next.config.ts headers too)
export const metadata: Metadata = {
  title: "Student progress (private)",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

type View = {
  student_name: string;
  expires_at: string;
  sessions: { date: string; start_time: string; end_time: string; status: "pending" | "confirmed" | "completed" }[];
  courses: { title: string; category: string; since: string }[];
  tests: { title: string; score: number; total_marks: number; submitted_at: string }[];
  prediction: { min_rank: number; max_rank: number; entered_rank: number | null; at: string } | null;
};

const CATEGORY: Record<string, string> = {
  crash_course: "Crash course", study_material: "Study material", previous_paper: "Previous year papers", mock_test: "Mock tests", counselling_package: "Counselling package",
};
const n = (x: number) => x.toLocaleString("en-IN");
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default function ParentPage({ params }: PageProps<"/parent/[token]">) {
  return (
    <section className="bg-slate-50 py-8 sm:py-12">
      <div className="container-page max-w-4xl">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </section>
  );
}

async function Content({ params }: { params: PageProps<"/parent/[token]">["params"] }) {
  const { token } = await params;
  const supabase = getPublicSupabase();
  // Supabase checks the secret (by its fingerprint), expiry and "turned off"
  const ok = /^[A-Za-z0-9_-]{32,128}$/.test(token);
  const { data, error } = ok && supabase ? await supabase.rpc("parent_view", { p_token: token }) : { data: null, error: null };
  const v = (error ? null : data) as View | null;

  if (!v) {
    return (
      <div className="card p-8 text-center sm:p-12">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500"><LockIcon className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">This link isn&apos;t working</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-600">It may have expired (links last 90 days) or been turned off. Please ask your child to send a new link from their {siteConfig.businessName} dashboard → <strong>Share with Parent</strong>.</p>
      </div>
    );
  }

  const day = today();
  const completed = v.sessions.filter((s) => s.status === "completed");
  const upcoming = v.sessions.filter((s) => s.status !== "completed" && s.date >= day).sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const pct = (t: View["tests"][number]) => (t.total_marks ? Math.round((t.score / t.total_marks) * 100) : 0);
  const avg = v.tests.length ? Math.round(v.tests.reduce((a, t) => a + pct(t), 0) / v.tests.length) : null;
  const first = v.student_name.split(" ")[0];

  return (
    <div className="space-y-5">
      <header className="card overflow-hidden">
        <div className="hero-bg p-6 text-white sm:p-8">
          <p className="text-sm font-semibold text-accent-300">{siteConfig.businessName} · Parent view</p>
          <h1 className="mt-1 text-3xl font-extrabold">{v.student_name}&apos;s progress</h1>
          <p className="mt-2 text-sm text-slate-300">A private, read-only summary shared by {first}. Link valid until {formatDate(v.expires_at.slice(0, 10), true)}.</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          {[
            ["Sessions done", String(completed.length)],
            ["Upcoming sessions", String(upcoming.length)],
            ["Tests taken", String(v.tests.length)],
            ["Average test score", avg === null ? "—" : `${avg}%`],
          ].map(([k, val]) => (
            <div key={k} className="p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-900">{val}</p>
              <p className="text-xs font-semibold text-slate-500">{k}</p>
            </div>
          ))}
        </div>
      </header>

      {v.prediction && (
        <section className="card flex items-center gap-4 p-5 sm:p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-400 text-brand-950"><TargetIcon className="h-6 w-6" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-500">Latest predicted VITEEE rank</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {v.prediction.entered_rank ? n(v.prediction.entered_rank) : `${n(v.prediction.min_rank)} – ${n(v.prediction.max_rank)}`}
            </p>
            <p className="text-xs text-slate-500">From the rank predictor on {formatDate(v.prediction.at.slice(0, 10))} · an estimate, not an official rank</p>
          </div>
        </section>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><CalendarIcon className="h-5 w-5" /> Counselling sessions</h2>
        {v.sessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No counselling sessions booked yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {[...upcoming, ...v.sessions.filter((s) => !upcoming.includes(s))].map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-slate-800">{formatDate(s.date, true)} · {formatTime(s.start_time)} – {formatTime(s.end_time)} IST</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.status === "completed" ? "bg-slate-100 text-slate-700" : s.date >= day ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {s.status === "completed" ? "Completed" : s.date >= day ? "Booked" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Mock tests</h2>
        {v.tests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No tests taken yet.</p>
        ) : (
          <>
            {v.tests.length >= 2 && (
              <div className="mt-4">
                <LineChart labels={v.tests.map((t) => shortDate(t.submitted_at))} series={[{ name: "Score", color: "#1d4ed8", points: v.tests.map(pct) }]} />
              </div>
            )}
            <ul className="mt-3 divide-y divide-slate-100">
              {[...v.tests].reverse().slice(0, 20).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{t.title}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(t.submitted_at)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-extrabold ${pct(t) >= 70 ? "bg-green-50 text-green-700" : pct(t) >= 40 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{t.score}/{t.total_marks} · {pct(t)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-slate-900">Courses &amp; study material</h2>
        {v.courses.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No courses or material yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {v.courses.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span><span className="block font-semibold text-slate-800">{c.title}</span><span className="text-xs text-slate-500">{CATEGORY[c.category] ?? c.category} · since {formatDate(c.since.slice(0, 10))}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-500">
        🔒 Private link — please don&apos;t forward it. This page is view-only. Questions about counselling? <Link href="/contact" className="font-semibold text-brand-700 underline">Contact {siteConfig.businessName}</Link>
      </p>
    </div>
  );
}
