import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton, EmptyBox, PageHeader, Panel } from "@/components/dashboard/ui";
import { BarList, LineChart } from "@/components/tests/Charts";
import { requireUser } from "@/lib/dashboard";
import { formatDateTime, formatDuration } from "@/lib/format";
import { SUBJECT_COLOR, SUBJECTS } from "@/lib/subjects";

export const metadata: Metadata = { title: "My Progress" };

type Attempt = {
  attempt_id: string; test_id: string; test_title: string; test_type: string; score: number; total_marks: number; submitted_at: string;
  time_taken_seconds: number; subjects: { subject: string; score: number; total: number; percent: number }[];
};

export default function ProgressPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

const pctOf = (a: Attempt) => (a.total_marks ? Math.round((a.score / a.total_marks) * 100) : 0);
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

async function Content() {
  const s = await requireUser("/dashboard/progress");
  // Only this student's attempts (Supabase my_progress() — supabase/test-analytics.sql)
  const { data, error } = await s.supabase.rpc("my_progress");
  if (error) {
    return (
      <>
        <PageHeader title="My Progress" subtitle="Your scores across all tests." />
        <p className="card p-6 text-slate-600">Progress tracking is being set up — please check back soon.</p>
      </>
    );
  }
  const attempts = (data ?? []) as Attempt[]; // oldest first
  if (attempts.length === 0) {
    return (
      <>
        <PageHeader title="My Progress" subtitle="Your scores across all tests." />
        <EmptyBox text="Take your first test to start tracking your progress." href="/dashboard/tests" cta="Go to My Tests" />
      </>
    );
  }

  const labels = attempts.map((a) => shortDate(a.submitted_at));
  const overall = attempts.map(pctOf);
  const last5 = overall.slice(-5);
  const prev5 = overall.slice(-10, -5);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((x, y) => x + y, 0) / xs.length) : 0);
  const trend = prev5.length ? avg(last5) - avg(prev5) : null;
  const best = attempts.reduce((b, a) => (pctOf(a) > pctOf(b) ? a : b));

  // Subject trends: % in each attempt that had questions of that subject
  const subjectsSeen = SUBJECTS.filter((sub) => attempts.some((a) => a.subjects.some((x) => x.subject === sub)));
  const series = subjectsSeen.map((sub) => ({
    name: sub,
    color: SUBJECT_COLOR[sub],
    points: attempts.map((a) => {
      const x = a.subjects.find((y) => y.subject === sub);
      return x ? Number(x.percent) : null;
    }),
  }));
  // Overall subject average (all attempts)
  const subjectAvg = subjectsSeen.map((sub) => {
    let score = 0, total = 0;
    for (const a of attempts) for (const x of a.subjects) if (x.subject === sub) { score += Number(x.score); total += Number(x.total); }
    return { label: sub, value: total ? Math.round((score / total) * 100) : 0, color: SUBJECT_COLOR[sub], note: `${score}/${total}` };
  }).sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="My Progress" subtitle="Your scores across all tests — keep the line going up!">
        <Link href="/dashboard/tests" className="btn-primary">Take a test</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Tests taken", String(attempts.length), ""],
          ["Average score", `${avg(overall)}%`, `last 5: ${avg(last5)}%`],
          ["Best score", `${pctOf(best)}%`, best.test_title],
          ["Trend", trend === null ? "—" : `${trend > 0 ? "▲ +" : trend < 0 ? "▼ " : ""}${trend}%`, trend === null ? "after 6 tests" : "last 5 vs 5 before"],
        ].map(([k, v, sub]) => (
          <div key={k} className="card p-4">
            <p className="text-xs font-semibold text-slate-500">{k}</p>
            <p className={`mt-1 text-2xl font-extrabold ${k === "Trend" && trend !== null ? (trend >= 0 ? "text-emerald-600" : "text-red-600") : "text-slate-900"}`}>{v}</p>
            {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <Panel title="Score in every test (%)">
          <LineChart labels={labels} series={[{ name: "Score", color: "#1d4ed8", points: overall }]} />
        </Panel>

        {series.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Subject-wise trend (%)">
              <LineChart labels={labels} series={series} />
            </Panel>
            <Panel title="Subject average (all tests)">
              <BarList rows={subjectAvg} />
              {subjectAvg.length >= 2 && (
                <p className="mt-4 text-sm text-slate-600">
                  💪 Strongest: <strong>{subjectAvg[0].label}</strong> · 🎯 Focus on: <strong>{subjectAvg.at(-1)!.label}</strong>
                </p>
              )}
            </Panel>
          </div>
        ) : (
          <p className="card p-5 text-sm text-slate-500">Subject-wise trends appear for tests whose questions have a subject.</p>
        )}

        <Panel title="All attempts">
          <ul className="divide-y divide-slate-100">
            {[...attempts].reverse().map((a) => {
              const p = pctOf(a);
              return (
                <li key={a.attempt_id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{a.test_title}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(a.submitted_at)} · {formatDuration(a.time_taken_seconds)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-sm font-extrabold ${p >= 70 ? "bg-green-50 text-green-700" : p >= 40 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>{a.score}/{a.total_marks} · {p}%</span>
                    <Link href={`/dashboard/tests/review?attempt=${a.attempt_id}`} className="text-sm font-semibold text-brand-700 underline">Review</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
