"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { CheckIcon, ClockIcon, CloseIcon } from "./Icons";

type Question = { id: string; question: string; options: string[]; marks: number };
type TestData = { id: string; title: string; duration_minutes: number; total_marks: number; questions: Question[] };
type Result = {
  attempt_id: string | null;
  score: number;
  total_marks: number;
  results: { question_id: string; your_answer: number | null; correct_option: number; explanation: string | null; marks: number }[];
};

// Runs a test. Questions arrive WITHOUT answers; the server scores the test
// (Supabase function submit_test) and only then sends back the answers.
export default function TestRunner({ testId }: { testId: string }) {
  const supabase = getBrowserSupabase();
  const [test, setTest] = useState<TestData | null>(null);
  const [loadError, setLoadError] = useState(supabase ? "" : "Tests will work once Supabase is connected.");
  const [loggedIn, setLoggedIn] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const startedAt = useRef<string>("");

  // Load the test
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    supabase.rpc("get_test_for_attempt", { p_test_id: testId }).then(({ data, error }) => {
      if (error) return setLoadError(error.message.includes("buy") ? "This is a paid test. Please buy it to start." : "Sorry, this test could not be found.");
      const t = data as TestData;
      setTest(t);
      setSecondsLeft(t.duration_minutes * 60);
      startedAt.current = new Date().toISOString();
    });
  }, [supabase, testId]);

  const submit = useCallback(async () => {
    if (!supabase || !test || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_test", {
      p_test_id: test.id,
      p_answers: answers,
      p_started_at: startedAt.current || null,
    });
    setSubmitting(false);
    if (error) return alert("Could not submit: " + error.message);
    setResult(data as Result);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [supabase, test, answers, submitting]);

  // Countdown timer — auto-submits when time is up
  useEffect(() => {
    if (!test || result) return;
    if (secondsLeft <= 0) {
      const id = setTimeout(submit, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, test, result, submit]);

  if (loadError) {
    return (
      <div className="card p-8 text-center">
        <p className="font-bold text-slate-900">{loadError}</p>
        <Link href="/mock-tests" className="btn-primary mt-6">See all tests</Link>
      </div>
    );
  }
  if (!test) return <p className="py-16 text-center text-slate-500" aria-busy="true">Loading test…</p>;
  if (test.questions.length === 0) return <p className="card p-8 text-center">This test has no questions yet.</p>;

  // ---------- Results ----------
  if (result) {
    const pct = result.total_marks ? Math.round((result.score / result.total_marks) * 100) : 0;
    return (
      <div className="card animate-fade-up p-6 sm:p-8">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-600">Your result</p>
        <p className="mt-2 text-center text-5xl font-extrabold text-slate-900">{result.score}/{result.total_marks}</p>
        <p className="mt-1 text-center text-slate-600">{pct >= 80 ? "Excellent! 🎉" : pct >= 50 ? "Good effort — keep practising!" : "Let's build your basics together."}</p>
        <p className="mt-3 text-center text-xs text-slate-500">
          {result.attempt_id ? "✓ Saved to your dashboard" : <><Link href="/login?next=/dashboard/tests" className="font-semibold text-brand-700 underline">Sign in</Link> next time to save your scores.</>}
        </p>
        <ol className="mt-8 space-y-4">
          {test.questions.map((q, i) => {
            const r = result.results.find((x) => x.question_id === q.id);
            if (!r) return null;
            const correct = r.your_answer === r.correct_option;
            return (
              <li key={q.id} className={`rounded-2xl p-4 ring-1 ${correct ? "bg-green-50 ring-green-200" : "bg-red-50 ring-red-200"}`}>
                <p className="flex items-start gap-2 font-semibold text-slate-900">
                  {correct ? <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : <CloseIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                  {i + 1}. {q.question}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Correct answer: <strong>{q.options[r.correct_option]}</strong>
                  {r.your_answer === null || r.your_answer === undefined ? " (not answered)" : !correct && <> · Your answer: {q.options[r.your_answer]}</>}
                </p>
                {r.explanation && <p className="mt-1 text-sm text-slate-600">{r.explanation}</p>}
              </li>
            );
          })}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/mock-tests" className="btn-primary">More tests</Link>
          {result.attempt_id && <Link href="/dashboard/tests" className="btn-light">My scores</Link>}
        </div>
      </div>
    );
  }

  // ---------- Question screen ----------
  const q = test.questions[current];
  const picked = answers[q.id];
  const answered = Object.keys(answers).length;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-500">Question {current + 1} of {test.questions.length}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold tabular-nums ${secondsLeft < 60 ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}>
          <ClockIcon className="h-4 w-4" /> {mm}:{ss}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(answered / test.questions.length) * 100}%` }} />
      </div>
      {!loggedIn && (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          Tip: <Link href={`/login?next=/tests/${test.id}`} className="font-semibold text-brand-700 underline">sign in</Link> to save your score.
        </p>
      )}

      <div key={current} className="animate-fade-up">
        <p className="mt-6 text-lg font-bold text-slate-900 sm:text-xl">{q.question}</p>
        <div className="mt-5 grid gap-3" role="radiogroup" aria-label="Options">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left font-semibold transition ${
                picked === i ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:border-brand-300"
              }`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${picked === i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button type="button" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0} className="btn-light disabled:opacity-40">Previous</button>
        {current < test.questions.length - 1 ? (
          <button type="button" onClick={() => setCurrent((c) => c + 1)} className="btn-primary">Next</button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting} className="btn-accent disabled:opacity-60">
            {submitting ? "Submitting…" : `Submit Test (${answered}/${test.questions.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
