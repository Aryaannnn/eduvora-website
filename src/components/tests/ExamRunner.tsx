"use client";

// =====================================================================
//  ONLINE TEST (mock / MCQ) — instructions → full-screen exam → result
//  Everything important happens on the SERVER (supabase/test-system.sql):
//   • start_test(): access check (free / bought), attempt limit, end time,
//     questions WITHOUT answers; resumes an unfinished attempt
//   • save_test_progress(): autosave every 5 s (+ a copy in this browser,
//     so nothing is lost if the internet drops or the page refreshes)
//   • submit_test_attempt(): scores on the server, then the report with
//     correct answers + explanations
// =====================================================================
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ClockIcon, CloseIcon, GridIcon } from "../Icons";
import TestRunner from "../TestRunner";
import AttemptReport, { type Report } from "./AttemptReport";

type Overview = {
  test_id: string; title: string; type: "mock" | "mcq"; subjects: string[]; duration_minutes: number; total_marks: number; questions: number;
  marks_per_correct: number; negative_marks: number; max_attempts: number | null; attempts_used: number; in_progress: boolean;
  instructions: string | null; is_free: boolean; is_sample: boolean;
};
type Q = { id: string; question: string; options: string[]; marks: number; subject: string | null; topic: string | null; image_url: string | null };
type Started = Omit<Overview, "questions" | "in_progress" | "instructions" | "is_free" | "is_sample"> & {
  attempt_id: string; started_at: string; ends_at: string; server_now: string;
  answers: Record<string, number>; marked: string[]; question_times: Record<string, number>; questions: Q[];
};
type SaveState = "saved" | "saving" | "offline" | "idle";

const LETTERS = ["A", "B", "C", "D"];
const AUTOSAVE_MS = 5000;
const backupKey = (attemptId: string) => `eduvora-test-${attemptId}`;

export default function ExamRunner({ testId }: { testId: string }) {
  const supabase = getBrowserSupabase();
  const [phase, setPhase] = useState<"loading" | "login" | "error" | "legacy" | "overview" | "starting" | "exam" | "result">(supabase ? "loading" : "error");
  const [error, setError] = useState(supabase ? "" : "Tests will work once Supabase is connected.");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [exam, setExam] = useState<Started | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  // ---------- 1. instructions screen ----------
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data: auth }) => {
      if (!alive) return;
      if (!auth.session) return setPhase("login");
      const { data, error: e } = await supabase.rpc("test_overview", { p_test_id: testId });
      if (!alive) return;
      if (e) {
        if (e.code === "PGRST202" || /could not find the function/i.test(e.message)) return setPhase("legacy"); // test-system.sql not run yet
        if (/log in/i.test(e.message)) return setPhase("login");
        setError(/buy/i.test(e.message) ? "This is a paid test. Please buy it to start." : "Sorry, this test could not be found.");
        return setPhase("error");
      }
      setOverview(data as Overview);
      setPhase("overview");
    });
    return () => {
      alive = false;
    };
  }, [supabase, testId]);

  const start = async () => {
    if (!supabase) return;
    setPhase("starting");
    // Full screen (works on most phones and computers; ignored where not allowed)
    document.documentElement.requestFullscreen?.().catch(() => {});
    const { data, error: e } = await supabase.rpc("start_test", { p_test_id: testId });
    if (e) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setError(e.message.replace(/^.*?:\s*/, "") || "Could not start the test.");
      return setPhase("error");
    }
    setExam(data as Started);
    setPhase("exam");
  };

  if (phase === "legacy") return <TestRunner testId={testId} />;
  if (phase === "loading" || phase === "starting") return <p className="py-16 text-center text-slate-500" aria-busy="true">{phase === "starting" ? "Starting your test…" : "Loading test…"}</p>;
  if (phase === "login") {
    const back = `/tests/${testId}`;
    return (
      <div className="card p-8 text-center">
        <p className="text-xl font-extrabold text-slate-900">Log in to take this test</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">Sign up free in a minute. Your answers, score and progress are saved in your dashboard.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={`/login?mode=signup&next=${encodeURIComponent(back)}`} className="btn-primary">Sign Up Free</Link>
          <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn-light">Log In</Link>
        </div>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="card p-8 text-center">
        <p className="font-bold text-slate-900">{error}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard/tests" className="btn-primary">My Tests</Link>
          <Link href="/mock-tests" className="btn-light">See all tests</Link>
        </div>
      </div>
    );
  }
  if (phase === "result" && report) return <div className="animate-fade-up"><AttemptReport r={report} /></div>;
  if (phase === "exam" && exam) {
    return (
      <Exam
        exam={exam}
        onDone={(r) => {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          setReport(r);
          setPhase("result");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }
  if (!overview) return null;

  // ---------- instructions ----------
  const o = overview;
  const left = o.max_attempts ? Math.max(0, o.max_attempts - o.attempts_used) : null;
  const blocked = left === 0 && !o.in_progress;
  return (
    <div className="card overflow-hidden">
      <div className="hero-bg p-6 text-white sm:p-8">
        {o.is_sample && <span className="mb-3 inline-block rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold">SAMPLE TEST</span>}
        <p className="text-sm font-semibold text-accent-300">{o.type === "mcq" ? "MCQ practice" : "Mock test"}{o.is_free ? " · Free" : ""}</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{o.title}</h1>
        {o.subjects.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{o.subjects.map((x) => <span key={x} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/20">{x}</span>)}</p>}
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Questions", String(o.questions)],
          ["Time", `${o.duration_minutes} min`],
          ["Total marks", String(o.total_marks)],
          ["Attempts", o.max_attempts ? `${o.attempts_used} of ${o.max_attempts} used` : `${o.attempts_used} used`],
        ].map(([k, v]) => (
          <div key={k} className="p-4 text-center">
            <p className="text-lg font-extrabold text-slate-900">{v}</p>
            <p className="text-xs font-semibold text-slate-500">{k}</p>
          </div>
        ))}
      </div>
      <div className="space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="font-extrabold text-slate-900">Marking scheme</h2>
          <p className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700 ring-1 ring-emerald-200">+{o.marks_per_correct} for each correct answer</span>
            <span className={`rounded-full px-3 py-1 font-bold ring-1 ${Number(o.negative_marks) > 0 ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
              {Number(o.negative_marks) > 0 ? `−${Number(o.negative_marks)} for each wrong answer` : "No negative marking"}
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-600 ring-1 ring-slate-200">0 if you leave it</span>
          </p>
        </div>
        <div>
          <h2 className="font-extrabold text-slate-900">Instructions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>The timer starts when you click <strong>Start test</strong> and keeps running even if you close the page.</li>
            <li>Use the <strong>question palette</strong> to jump between questions. <strong>Mark for review</strong> to come back later.</li>
            <li>Your answers are <strong>saved automatically</strong> every few seconds. If the internet drops or the page refreshes, open the test again to continue.</li>
            <li>The test is <strong>submitted automatically</strong> when the time ends.</li>
            {o.instructions && <li className="whitespace-pre-line">{o.instructions}</li>}
          </ul>
        </div>
        {blocked ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">You have used all {o.max_attempts} attempts for this test. See your results in My Tests.</p>
        ) : (
          <button type="button" onClick={start} className="btn-accent w-full !py-4 text-lg sm:w-auto sm:!px-10">
            {o.in_progress ? "Resume test" : "Start test"}
          </button>
        )}
        <p className="text-xs text-slate-500">
          {left !== null && !blocked && `${left} attempt${left === 1 ? "" : "s"} left. `}
          <Link href="/dashboard/tests" className="font-semibold text-brand-700 underline">Back to My Tests</Link>
        </p>
      </div>
    </div>
  );
}

// =====================================================================
//  The exam screen
// =====================================================================
export function Exam({ exam, onDone }: { exam: Started; onDone: (r: Report) => void }) {
  const supabase = getBrowserSupabase()!;
  const qs = exam.questions;
  const n = qs.length;

  // Restore: server autosave + this browser's newer copy (if the internet dropped)
  const initial = useMemo(() => {
    let answers = { ...exam.answers };
    let marked = [...exam.marked];
    let times = { ...exam.question_times };
    try {
      const raw = localStorage.getItem(backupKey(exam.attempt_id));
      if (raw) {
        // This device's copy is written on every click, so it is never older than the server's
        const b = JSON.parse(raw) as { answers?: Record<string, number>; marked?: string[]; times?: Record<string, number> };
        if (b.answers) answers = b.answers;
        if (b.marked) marked = b.marked;
        times = { ...times, ...(b.times ?? {}) };
      }
    } catch {
      /* no copy */
    }
    return { answers, marked, times };
  }, [exam]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(initial.answers);
  const [marked, setMarked] = useState<Set<string>>(new Set(initial.marked));
  const [visited, setVisited] = useState<Set<string>>(() => new Set([qs[0]?.id, ...Object.keys(initial.answers)]));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Clock: the server decides the end time; correct for this device's clock
  // (the clock is read only after the screen appears, never while the page is being built)
  const offset = useRef(0);
  const endsAt = new Date(exam.ends_at).getTime();
  const remainingNow = useCallback(() => Math.max(0, Math.round((endsAt - (Date.now() + offset.current)) / 1000)), [endsAt]);
  const [left, setLeft] = useState<number | null>(null);

  // Latest values for the autosave timer
  const times = useRef<Record<string, number>>(initial.times);
  const shownSince = useRef(0);
  const dirty = useRef(false);
  // Always the newest values (updated in the click handlers) for autosave / submit
  const latest = useRef({ answers: initial.answers, marked: new Set(initial.marked), current: 0 });
  const submittedRef = useRef(false);
  const submitRef = useRef<(auto: boolean) => Promise<void>>(async () => {});

  const accrue = useCallback(() => {
    const q = qs[latest.current.current];
    if (q && shownSince.current) times.current[q.id] = (times.current[q.id] ?? 0) + (Date.now() - shownSince.current) / 1000;
    shownSince.current = Date.now();
  }, [qs]);

  const backup = useCallback(() => {
    try {
      localStorage.setItem(backupKey(exam.attempt_id), JSON.stringify({ answers: latest.current.answers, marked: [...latest.current.marked], times: times.current, at: Date.now() }));
    } catch {
      /* private mode */
    }
  }, [exam.attempt_id]);

  const roundTimes = () => Object.fromEntries(Object.entries(times.current).map(([k, v]) => [k, Math.round(v)]));

  const save = useCallback(
    async (force = false) => {
      if (submittedRef.current || (!dirty.current && !force)) return;
      accrue();
      backup();
      setSaveState("saving");
      dirty.current = false;
      const { data, error } = await supabase.rpc("save_test_progress", {
        p_attempt: exam.attempt_id,
        p_answers: latest.current.answers,
        p_marked: [...latest.current.marked],
        p_times: roundTimes(),
      });
      if (error) {
        dirty.current = true; // try again next round
        setSaveState("offline");
        return;
      }
      const r = data as { ok: boolean; time_over?: boolean; submitted?: boolean };
      setSaveState(r.ok ? "saved" : "idle");
      if (r.time_over || r.submitted) void submitRef.current(true);
    },
     
    [supabase, exam.attempt_id, accrue, backup],
  );

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setConfirming(false);
      accrue();
      backup();
      for (let tries = 0; tries < 30; tries++) {
        const { data, error } = await supabase.rpc("submit_test_attempt", {
          p_attempt: exam.attempt_id,
          p_answers: latest.current.answers,
          p_times: roundTimes(),
        });
        if (!error && data) {
          try {
            localStorage.removeItem(backupKey(exam.attempt_id));
          } catch {
            /* ignore */
          }
          onDone(data as Report);
          return;
        }
        setSubmitError(auto ? "Time is up — submitting your answers… (waiting for the internet)" : "Could not submit — retrying… (check your internet)");
        await new Promise((r) => setTimeout(r, 4000));
      }
      setSubmitError("Could not reach the server. Your answers are saved — open My Tests later and your test will be submitted automatically.");
    },
     
    [supabase, exam.attempt_id, accrue, backup, onDone],
  );
  useEffect(() => {
    submitRef.current = doSubmit;
  }, [doSubmit]);

  // Autosave every 5 s, on tab switch / close, and when back online
  useEffect(() => {
    const id = setInterval(() => void save(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    const onOnline = () => void save(true);
    const onUnload = (e: BeforeUnloadEvent) => {
      backup();
      if (!submittedRef.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, backup]);

  // Countdown → auto-submit at 0
  useEffect(() => {
    offset.current = new Date(exam.server_now).getTime() - Date.now();
    shownSince.current = Date.now();
    setLeft(remainingNow());
    const id = setInterval(() => {
      const l = remainingNow();
      setLeft(l);
      if (l <= 0) void doSubmit(true);
    }, 1000);
    return () => clearInterval(id);
  }, [remainingNow, doSubmit, exam.server_now]);

  // ---------- actions ----------
  const changed = () => {
    dirty.current = true;
    backup();
  };
  const goTo = (i: number) => {
    if (i < 0 || i >= n) return;
    accrue();
    latest.current.current = i;
    setCurrent(i);
    setVisited((v) => new Set(v).add(qs[i].id));
    setPaletteOpen(false);
  };
  const q = qs[current];
  const pick = (opt: number) => {
    const next = { ...answers, [q.id]: opt };
    latest.current.answers = next;
    setAnswers(next);
    changed();
  };
  const clear = () => {
    const next = { ...answers };
    delete next[q.id];
    latest.current.answers = next;
    setAnswers(next);
    changed();
  };
  const toggleMark = () => {
    const next = new Set(marked);
    if (next.has(q.id)) next.delete(q.id);
    else next.add(q.id);
    latest.current.marked = next;
    setMarked(next);
    changed();
  };
  const markAndNext = () => {
    if (!marked.has(q.id)) toggleMark();
    goTo(Math.min(n - 1, current + 1));
  };

  // ---------- counts + palette ----------
  const answeredCount = qs.filter((x) => x.id in answers).length;
  const markedCount = qs.filter((x) => marked.has(x.id)).length;
  const notAnsweredCount = qs.filter((x) => visited.has(x.id) && !(x.id in answers)).length;
  const notVisitedCount = qs.filter((x) => !visited.has(x.id)).length;
  const statusOf = (x: Q) =>
    marked.has(x.id) ? (x.id in answers ? "marked-answered" : "marked") : x.id in answers ? "answered" : visited.has(x.id) ? "not-answered" : "not-visited";
  const chip: Record<string, string> = {
    answered: "bg-emerald-500 text-white",
    "not-answered": "bg-rose-500 text-white",
    "not-visited": "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    marked: "bg-violet-600 text-white",
    "marked-answered": "bg-violet-600 text-white ring-2 ring-emerald-400",
  };

  const mm = left === null ? "--" : String(Math.floor(left / 60)).padStart(2, "0");
  const ss = left === null ? "--" : String(left % 60).padStart(2, "0");
  const lowTime = left !== null && left <= 300;

  const Palette = (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {qs.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Question ${i + 1}: ${statusOf(x).replace("-", " ")}`}
            aria-current={i === current ? "true" : undefined}
            className={`relative grid h-10 place-items-center rounded-lg text-sm font-bold transition ${chip[statusOf(x)]} ${i === current ? "outline outline-2 outline-offset-2 outline-brand-700" : ""}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-emerald-500" /> Answered ({answeredCount})</li>
        <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-rose-500" /> Not answered ({notAnsweredCount})</li>
        <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-slate-100 ring-1 ring-slate-300" /> Not visited ({notVisitedCount})</li>
        <li className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-violet-600" /> For review ({markedCount})</li>
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">Purple with a green ring = answered and marked for review (it will be scored).</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-label={exam.title}>
      {/* Top bar */}
      <header className="flex items-center gap-3 bg-brand-900 px-3 py-2.5 text-white shadow-lg sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold sm:text-base">{exam.title}</p>
          <p className="text-[11px] text-slate-300" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ All answers saved" : saveState === "offline" ? (
              <>⚠ Offline<span className="hidden sm:inline"> — answers kept on this device, will save when back</span><span className="sm:hidden"> — kept on this device</span></>
            ) : "Answers save automatically"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-extrabold tabular-nums ${lowTime ? "animate-pulse bg-red-600" : "bg-white/10"}`} role="timer" aria-label={`Time left ${mm} minutes ${ss} seconds`}>
          <ClockIcon className="h-4 w-4" /> {mm}:{ss}
        </span>
        <button type="button" onClick={() => setConfirming(true)} disabled={submitting} className="btn-accent !px-4 !py-2 text-sm disabled:opacity-60">Submit</button>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 overflow-y-auto p-3 sm:p-5 lg:grid-cols-[1fr_19rem]">
        {/* Question */}
        <section className="card flex flex-col p-5 sm:p-7" aria-labelledby="q-text">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-slate-500">Question {current + 1} of {n}{q.subject ? ` · ${q.subject}` : ""}</span>
            <span className="flex gap-1.5">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">+{q.marks}</span>
              {Number(exam.negative_marks) > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">−{Number(exam.negative_marks)}</span>}
              {marked.has(q.id) && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">Marked for review</span>}
            </span>
          </div>
          <div key={q.id} className="animate-fade-up">
            <p id="q-text" className="mt-4 whitespace-pre-line text-lg font-bold leading-relaxed text-slate-900 sm:text-xl">{q.question}</p>
            {q.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image_url} alt={`Figure for question ${current + 1}`} className="mt-4 max-h-72 w-auto max-w-full rounded-xl ring-1 ring-slate-200" />
            )}
            <div className="mt-5 grid gap-3" role="radiogroup" aria-labelledby="q-text">
              {q.options.map((opt, i) => {
                const on = answers[q.id] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick(i)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left font-semibold transition sm:p-4 ${on ? "border-brand-600 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{LETTERS[i]}</span>
                    <span className="whitespace-pre-line">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={clear} disabled={!(q.id in answers)} className="btn-light !px-4 !py-2 text-sm disabled:opacity-40">Clear answer</button>
              <button type="button" onClick={toggleMark} className={`btn-light !px-4 !py-2 text-sm ${marked.has(q.id) ? "!bg-violet-50 !text-violet-700" : ""}`}>
                {marked.has(q.id) ? "Unmark review" : "Mark for review"}
              </button>
              {!marked.has(q.id) && current < n - 1 && <button type="button" onClick={markAndNext} className="btn-light !px-4 !py-2 text-sm">Mark & next</button>}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} className="btn-light disabled:opacity-40" aria-label="Previous question">←<span className="hidden sm:inline"> Previous</span></button>
              <button type="button" onClick={() => setPaletteOpen(true)} className="btn-light !px-3 lg:hidden" aria-label="Open question palette"><GridIcon /> {answeredCount}/{n}</button>
              {current < n - 1 ? (
                <button type="button" onClick={() => goTo(current + 1)} className="btn-primary">{q.id in answers ? "Save & next →" : "Next →"}</button>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="btn-accent">Submit test</button>
              )}
            </div>
          </div>
        </section>

        {/* Palette (desktop) */}
        <aside className="card hidden h-fit p-5 lg:block" aria-label="Question palette">
          <p className="mb-3 text-sm font-extrabold text-slate-900">Questions</p>
          {Palette}
        </aside>
      </div>

      {/* Palette (phone) */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/50 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Question palette">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-extrabold text-slate-900">Questions</p>
              <button type="button" onClick={() => setPaletteOpen(false)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close"><CloseIcon className="h-5 w-5" /></button>
            </div>
            {Palette}
          </div>
        </div>
      )}

      {/* Confirm submit */}
      {(confirming || submitting) && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" role="alertdialog" aria-labelledby="sub-title">
            {submitting ? (
              <>
                <p id="sub-title" className="text-xl font-extrabold text-slate-900">Submitting your test…</p>
                <p className="mt-2 text-sm text-slate-600">{submitError || "Calculating your score on the server."}</p>
              </>
            ) : (
              <>
                <p id="sub-title" className="text-xl font-extrabold text-slate-900">Submit the test?</p>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <li className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">Answered: {answeredCount}</li>
                  <li className="rounded-xl bg-slate-50 p-3 font-semibold text-slate-700">Unanswered: {n - answeredCount}</li>
                  <li className="rounded-xl bg-violet-50 p-3 font-semibold text-violet-800">For review: {markedCount}</li>
                  <li className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-800">Time left: {formatDuration(left ?? 0)}</li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">You can&apos;t change answers after submitting.</p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setConfirming(false)} className="btn-light">Keep working</button>
                  <button type="button" onClick={() => void doSubmit(false)} className="btn-accent">Yes, submit</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
