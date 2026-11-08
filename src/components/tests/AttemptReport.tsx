"use client";

// The result of one test attempt: score, accuracy, time, subject-wise
// scores (bar chart), strongest / weakest subject, time per question and
// "Review answers" (your answer, correct answer, explanation).
// Data from Supabase attempt_report() / submit_test() (supabase/test-analytics.sql).
import Link from "next/link";
import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { SUBJECT_COLOR } from "@/lib/subjects";
import { CheckIcon, ClockIcon, CloseIcon, TargetIcon } from "../Icons";
import { BarList, QuestionTimeChart } from "./Charts";

export type ReportQuestion = {
  question_id: string; question: string; options: string[]; your_answer: number | null; correct_option: number; explanation: string | null;
  marks: number; subject: string | null; topic: string | null; seconds: number | null; result: "correct" | "wrong" | "skipped";
  image_url?: string | null; marked?: boolean;
};
export type ReportSubject = { subject: string; score: number; total: number; correct: number; wrong: number; skipped: number; percent: number; seconds: number };
export type Report = {
  attempt_id: string; test_id: string; test_title: string; duration_minutes: number; score: number; total_marks: number;
  correct: number; wrong: number; skipped: number; accuracy: number; time_taken_seconds: number; submitted_at: string | null;
  subjects: ReportSubject[]; questions: ReportQuestion[];
  // supabase/test-system.sql
  marks_per_correct?: number; negative_marks?: number; negative_total?: number; max_attempts?: number | null; attempts_used?: number;
};

const LETTERS = ["A", "B", "C", "D"];

export default function AttemptReport({ r, openReview = false }: { r: Report; openReview?: boolean }) {
  const [review, setReview] = useState(openReview);
  const [only, setOnly] = useState<"all" | "wrong" | "skipped">("all");
  const score = Number(r.score);
  const pct = r.total_marks ? Math.max(0, Math.round((score / r.total_marks) * 100)) : 0;
  const neg = Number(r.negative_marks ?? 0);
  const attemptsLeft = r.max_attempts ? Math.max(0, r.max_attempts - (r.attempts_used ?? 0)) : null;
  const n = r.questions.length;
  const real = r.subjects.filter((s) => s.subject !== "General" && s.total > 0);
  const ranked = [...real].sort((a, b) => b.percent - a.percent || b.score - a.score);
  const strongest = ranked.length >= 2 ? ranked[0] : null;
  const weakest = ranked.length >= 2 && ranked.at(-1)!.percent < ranked[0].percent ? ranked.at(-1)! : null;
  const timed = r.questions.some((q) => q.seconds !== null);
  const avgPerQ = n ? Math.round(r.time_taken_seconds / n) : 0;
  const shown = r.questions.map((q, i) => ({ q, i })).filter(({ q }) => only === "all" || q.result === only);

  return (
    <div className="space-y-5">
      {/* Score */}
      <section className="card p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Your result · {r.test_title}</p>
        <p className="mt-2 text-5xl font-extrabold text-slate-900">{score % 1 ? score.toFixed(2) : score}<span className="text-2xl text-slate-400">/{r.total_marks}</span></p>
        {neg > 0 && <p className="mt-1 text-sm font-semibold text-red-600">Includes −{Number(r.negative_total ?? 0)} negative marks ({r.wrong} wrong × {neg})</p>}
        <p className="mt-1 text-slate-600">{pct >= 80 ? "Excellent! 🎉" : pct >= 50 ? "Good effort — keep practising!" : "Let's build your basics together."}</p>
        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Score", `${pct}%`, <TargetIcon key="i" className="h-4 w-4" />],
            ["Accuracy", `${r.accuracy}%`, <CheckIcon key="i" className="h-4 w-4" />],
            ["Time taken", formatDuration(r.time_taken_seconds), <ClockIcon key="i" className="h-4 w-4" />],
            ["Correct · Wrong · Unattempted", `${r.correct} · ${r.wrong} · ${r.skipped}`, null],
          ].map(([k, v, icon]) => (
            <div key={k as string} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-500">{icon}{k}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Accuracy = correct answers out of the questions you attempted. Average {formatDuration(avgPerQ)} per question.</p>
      </section>

      {/* Subjects */}
      {real.length > 0 && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-900">Subject-wise score</h2>
          <div className="mt-4">
            <BarList rows={r.subjects.filter((s) => s.total > 0).map((s) => ({ label: s.subject, value: Number(s.percent), color: SUBJECT_COLOR[s.subject] ?? SUBJECT_COLOR.General, note: `${s.score}/${s.total}` }))} />
          </div>
          {(strongest || weakest) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {strongest && (
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">💪 Strongest subject</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900">{strongest.subject} · {strongest.percent}%</p>
                  <p className="text-sm text-slate-600">Keep it up — {strongest.correct} correct out of {strongest.correct + strongest.wrong + strongest.skipped}.</p>
                </div>
              )}
              {weakest && (
                <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">🎯 Needs work</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900">{weakest.subject} · {weakest.percent}%</p>
                  <p className="text-sm text-slate-600">
                    {weakest.wrong} wrong{weakest.skipped ? `, ${weakest.skipped} skipped` : ""}. Review these questions below
                    {(() => {
                      const topics = [...new Set(r.questions.filter((q) => q.subject === weakest.subject && q.result !== "correct" && q.topic).map((q) => q.topic))].slice(0, 3);
                      return topics.length ? ` — topics: ${topics.join(", ")}` : "";
                    })()}.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Time per question */}
      {timed && n > 0 && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-900">Time spent per question</h2>
          <div className="mt-4">
            <QuestionTimeChart items={r.questions.map((q, i) => ({ n: i + 1, seconds: q.seconds ?? 0, result: q.result }))} />
          </div>
          {(() => {
            const slow = r.questions.map((q, i) => ({ q, i })).filter(({ q }) => (q.seconds ?? 0) > Math.max(60, avgPerQ * 2)).slice(0, 3);
            return slow.length ? <p className="mt-3 text-sm text-slate-600">⏱️ You spent the longest on question{slow.length > 1 ? "s" : ""} {slow.map(({ i }) => i + 1).join(", ")}. On test day, skip and come back to save time.</p> : null;
          })()}
        </section>
      )}

      {/* Review */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">Review answers</h2>
          <button type="button" onClick={() => setReview(!review)} className={review ? "btn-light !py-2 text-sm" : "btn-primary !py-2 text-sm"} aria-expanded={review}>
            {review ? "Hide review" : "Review answers"}
          </button>
        </div>
        {review && (
          <>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
              {([["all", `All (${n})`], ["wrong", `Wrong (${r.wrong})`], ["skipped", `Unattempted (${r.skipped})`]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setOnly(k)} aria-pressed={only === k} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${only === k ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}>{label}</button>
              ))}
            </div>
            <ol className="mt-4 space-y-4">
              {shown.map(({ q, i }) => (
                <li key={q.question_id} className={`rounded-2xl p-4 ring-1 ${q.result === "correct" ? "bg-green-50 ring-green-200" : q.result === "wrong" ? "bg-red-50 ring-red-200" : "bg-slate-50 ring-slate-200"}`}>
                  <p className="flex items-start gap-2 font-semibold text-slate-900">
                    {q.result === "correct" ? <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : q.result === "wrong" ? <CloseIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /> : <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-300 text-[10px] font-bold text-white">–</span>}
                    <span>{i + 1}. {q.question}</span>
                  </p>
                  <p className="mt-1 pl-7 text-xs text-slate-500">
                    {[q.subject, q.topic].filter(Boolean).join(" · ")}{q.subject ? " · " : ""}{q.marks} mark{q.marks > 1 ? "s" : ""}{q.seconds !== null ? ` · ${q.seconds}s` : ""}
                  </p>
                  {q.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image_url} alt={`Figure for question ${i + 1}`} loading="lazy" className="ml-7 mt-3 max-h-64 max-w-[calc(100%-1.75rem)] rounded-lg ring-1 ring-slate-200" />
                  )}
                  <ul className="mt-3 grid gap-1.5 pl-7 text-sm">
                    {q.options.map((o, j) => {
                      const isCorrect = j === q.correct_option;
                      const isYours = j === q.your_answer;
                      return (
                        <li key={j} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 ${isCorrect ? "bg-green-100 font-semibold text-green-900" : isYours ? "bg-red-100 text-red-900" : "text-slate-700"}`}>
                          <span className="font-bold">{LETTERS[j]}.</span>
                          <span className="flex-1">{o}</span>
                          {isCorrect && <span className="shrink-0 text-xs font-bold">✓ Correct</span>}
                          {isYours && !isCorrect && <span className="shrink-0 text-xs font-bold">Your answer</span>}
                          {isYours && isCorrect && <span className="shrink-0 text-xs font-bold">· Your answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {q.result === "skipped" && <p className="mt-2 pl-7 text-sm text-slate-600">You did not answer this question.</p>}
                  {q.explanation && <p className="mt-2 rounded-lg bg-white/70 p-2.5 pl-7 text-sm text-slate-700"><strong>Explanation:</strong> {q.explanation}</p>}
                </li>
              ))}
              {shown.length === 0 && <li className="text-sm text-slate-500">Nothing here 🎉</li>}
            </ol>
          </>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {attemptsLeft !== 0 && <Link href={`/tests/${r.test_id}`} className="btn-accent">Retake test{attemptsLeft !== null ? ` (${attemptsLeft} left)` : ""}</Link>}
        <Link href="/dashboard/progress" className="btn-primary">My Progress</Link>
        <Link href="/dashboard/tests" className="btn-light">My Tests</Link>
      </div>
    </div>
  );
}
