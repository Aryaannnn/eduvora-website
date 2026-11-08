import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton, EmptyBox, PageHeader, Panel } from "@/components/dashboard/ui";
import { ClipboardIcon, ClockIcon, TargetIcon } from "@/components/Icons";
import { getFreeTests, getMyAttempts, getMyPurchases, paidOnly, requireUser, type TestInfo } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "My Tests" };

export default function TestsPage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <TestsContent />
    </Suspense>
  );
}

async function TestsContent() {
  const s = await requireUser("/dashboard/tests");
  const [free, purchases, attempts] = await Promise.all([getFreeTests(s), getMyPurchases(s), getMyAttempts(s)]);

  // Tests inside products the student PAID for
  const seen = new Set(free.map((t) => t.id));
  const bought: (TestInfo & { pack: string })[] = [];
  for (const p of paidOnly(purchases)) {
    for (const t of p.products!.tests ?? []) {
      if (t.is_active && !seen.has(t.id)) {
        seen.add(t.id);
        bought.push({ ...t, pack: p.products!.title });
      }
    }
  }

  // Best score, number of attempts and an unfinished attempt per test (for the test cards)
  const done = attempts.filter((a) => a.submitted_at);
  const open = new Map(attempts.filter((a) => !a.submitted_at).map((a) => [a.test_id, a]));
  const best = new Map<string, number>();
  const count = new Map<string, number>();
  for (const a of done) best.set(a.test_id, Math.max(best.get(a.test_id) ?? -Infinity, a.score));
  for (const a of attempts) count.set(a.test_id, (count.get(a.test_id) ?? 0) + 1);

  return (
    <>
      <PageHeader title="My Tests" subtitle="Practise, track your scores and improve every week.">
        <Link href="/dashboard/progress" className="btn-light">📈 My Progress</Link>
      </PageHeader>
      <div className="space-y-6">
        <Panel title="Your tests">
          {free.length + bought.length === 0 ? (
            <EmptyBox text="No tests available yet." href="/mock-tests" cta="See mock tests" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {[...bought.map((t) => ({ ...t, tag: "Purchased", sub: t.pack })), ...free.map((t) => ({ ...t, tag: "Free", sub: "" }))].map((t) => (
                <li key={t.id} className="flex flex-col rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${t.type === "mcq" ? "bg-rose-500" : "bg-emerald-500"}`}>
                      {t.type === "mcq" ? <TargetIcon className="h-5 w-5" /> : <ClipboardIcon className="h-5 w-5" />}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${t.tag === "Free" ? "bg-green-100 text-green-700" : "bg-brand-100 text-brand-700"}`}>{t.tag}</span>
                  </div>
                  <p className="mt-3 font-bold text-slate-900">{t.title}</p>
                  {t.sub && <p className="text-xs text-slate-500">{t.sub}</p>}
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <ClockIcon className="h-3.5 w-3.5" /> {t.duration_minutes} min · {t.total_marks} marks
                    {best.has(t.id) && <span className="ml-1 font-semibold text-brand-700">· Best: {best.get(t.id)}/{t.total_marks}</span>}
                  </p>
                  {count.has(t.id) && <p className="mt-0.5 text-xs text-slate-500">{count.get(t.id)} attempt{count.get(t.id) === 1 ? "" : "s"}</p>}
                  {open.has(t.id) ? (
                    <Link href={`/tests/${t.id}`} className="btn-primary mt-4 !bg-violet-600 !py-2.5 hover:!bg-violet-700">▶ Resume test</Link>
                  ) : (
                    <Link href={`/tests/${t.id}`} className="btn-accent mt-4 !py-2.5">{best.has(t.id) ? "Retake test" : "Start test"}</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-slate-500">
            Want more practice? <Link href="/mock-tests" className="font-semibold text-brand-700 underline">Browse mock tests & MCQ packs</Link>
          </p>
        </Panel>

        <Panel title="Past attempts">
          {attempts.length === 0 ? (
            <p className="text-slate-500">No attempts yet — your scores will appear here after you submit a test.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attempts.map((a) => {
                const total = a.tests?.total_marks ?? 0;
                const pct = total ? Math.max(0, Math.round((a.score / total) * 100)) : 0;
                if (!a.submitted_at) {
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{a.tests?.title ?? "Test"}</p>
                        <p className="text-xs font-semibold text-violet-700">In progress — your answers are saved{a.ends_at ? ` · ends ${formatDateTime(a.ends_at)}` : ""}</p>
                      </div>
                      <Link href={`/tests/${a.test_id}`} className="btn-primary shrink-0 !bg-violet-600 !px-4 !py-2 text-sm hover:!bg-violet-700">Resume</Link>
                    </li>
                  );
                }
                return (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{a.tests?.title ?? "Test"}</p>
                      {a.submitted_at && <p className="text-xs text-slate-500">{formatDateTime(a.submitted_at)}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <div className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="w-16 text-right text-lg font-extrabold text-slate-900">{a.score}<span className="text-sm text-slate-400">/{total}</span></p>
                      <Link href={`/dashboard/tests/review?attempt=${a.id}`} className="text-sm font-semibold text-brand-700 underline">Review</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
