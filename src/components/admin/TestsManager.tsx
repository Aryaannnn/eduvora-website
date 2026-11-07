"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { bulkAddQuestions, deleteQuestion, deleteTest, saveQuestion, saveTest, type QuestionInput } from "@/app/admin/actions";
import { parseCsv } from "@/lib/csv";
import { formatDuration } from "@/lib/format";
import { normaliseSubject, SUBJECTS } from "@/lib/subjects";
import { DownloadIcon, EditIcon, PlusIcon, TrashIcon, UploadIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Pill, Toggle } from "./ui";

export type AdminTest = { id: string; title: string; type: "mock" | "mcq"; duration_minutes: number; total_marks: number; is_free: boolean; is_active: boolean; product_id: string | null; created_at: string };
export type AdminQuestion = { id: string; test_id: string; question: string; options: string[]; correct_option: number; explanation: string | null; marks: number; sort_order: number; subject?: string | null; topic?: string | null };
export type TestStats = {
  test_id: string; attempts: number; students: number; avg_score: number; avg_percent: number; avg_seconds: number;
  missed: { question_id: string; question: string; subject: string | null; topic: string | null; wrong: number; skipped: number; wrong_percent: number }[];
};
type Product = { id: string; title: string; category: string };
type Msg = { kind: "error" | "success"; text: string } | null;

const LETTERS = ["A", "B", "C", "D"];

export default function TestsManager({ tests, questions, products, stats = [], subjectsReady = true }: { tests: AdminTest[]; questions: AdminQuestion[]; products: Product[]; stats?: TestStats[]; subjectsReady?: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(tests[0]?.id ?? null);
  const [testForm, setTestForm] = useState<AdminTest | "new" | null>(null);
  const [qForm, setQForm] = useState<AdminQuestion | "new" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  const selected = tests.find((t) => t.id === selectedId) ?? null;
  const stat = stats.find((x) => x.test_id === selectedId) ?? null;
  const qs = questions.filter((q) => q.test_id === selectedId);
  const countFor = (id: string) => questions.filter((q) => q.test_id === id).length;
  const productTitle = (id: string | null) => products.find((p) => p.id === id)?.title;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (res.message ? { kind: "success", text: res.message } : null) : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) { after?.(); router.refresh(); }
    });

  return (
    <>
      <AdminHeader title="Tests & questions" subtitle="Create tests and manage their questions. Students never see answers before submitting.">
        <a href="/sample-questions.csv" download className="btn-light"><DownloadIcon /> Sample CSV</a>
        <button type="button" onClick={() => setTestForm("new")} className="btn-primary"><PlusIcon /> New test</button>
      </AdminHeader>
      {msg && <div className="mb-4 whitespace-pre-line"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`grid gap-6 xl:grid-cols-[18rem_1fr] ${pending ? "opacity-60" : ""}`}>
        {/* Test list */}
        <section className="card p-3">
          {tests.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No tests yet. Click <strong>New test</strong>.</p>
          ) : (
            <ul className="space-y-1">
              {tests.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${t.id === selectedId ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"}`}
                  >
                    <span className="block font-semibold text-slate-900">{t.title}</span>
                    <span className="block text-xs text-slate-500">
                      {t.type === "mcq" ? "MCQ" : "Mock"} · {countFor(t.id)} questions · {t.is_free ? "Free" : "Paid"}{t.is_active ? "" : " · Hidden"}
                      {stats.find((x) => x.test_id === t.id) && ` · ${stats.find((x) => x.test_id === t.id)!.attempts} attempts`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Selected test */}
        {selected ? (
          <section className="space-y-4">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">{selected.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {selected.type === "mcq" ? "MCQ" : "Mock"} · {selected.duration_minutes} min · {selected.total_marks} marks
                    <Pill on={selected.is_free} onLabel="Free" offLabel="Paid" />
                    <Pill on={selected.is_active} onLabel="Visible" offLabel="Hidden" />
                  </p>
                  {!selected.is_free && <p className="mt-1 text-xs text-slate-500">Unlocked by buying: <strong>{productTitle(selected.product_id) ?? "— no product linked —"}</strong></p>}
                </div>
                <div className="flex gap-2">
                  <a href={`/tests/${selected.id}`} target="_blank" className="btn-light !px-3 !py-1.5 text-xs">Preview</a>
                  <button type="button" onClick={() => setTestForm(selected)} className="btn-light !px-3 !py-1.5 text-xs"><EditIcon /> Edit</button>
                  <button type="button" onClick={() => confirm(`Delete "${selected.title}" with all its questions and student attempts?`) && run(() => deleteTest(selected.id), () => setSelectedId(null))} className="btn-light !px-3 !py-1.5 text-xs !text-red-600"><TrashIcon /> Delete</button>
                </div>
              </div>
            </div>

            <StatsCard stat={stat} total={selected.total_marks} />

            <CsvUpload testId={selected.id} onDone={(m) => { setMsg(m); if (m?.kind === "success") router.refresh(); }} />

            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900">Questions ({qs.length})</h3>
                <button type="button" onClick={() => setQForm("new")} className="btn-primary !px-4 !py-2 text-sm"><PlusIcon /> Add question</button>
              </div>
              {qs.length === 0 ? (
                <p className="text-sm text-slate-500">No questions yet — add one or upload a CSV.</p>
              ) : (
                <ol className="space-y-3">
                  {qs.map((q, i) => (
                    <li key={q.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-900">{i + 1}. {q.question}</p>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => setQForm(q)} className="btn-light !px-2.5 !py-1 text-xs" aria-label="Edit question"><EditIcon /></button>
                          <button type="button" onClick={() => confirm("Delete this question?") && run(() => deleteQuestion(q.id))} className="btn-light !px-2.5 !py-1 text-xs !text-red-600" aria-label="Delete question"><TrashIcon /></button>
                        </div>
                      </div>
                      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {q.options.map((o, j) => (
                          <li key={j} className={j === q.correct_option ? "font-bold text-green-700" : "text-slate-600"}>{LETTERS[j]}. {o}{j === q.correct_option && " ✓"}</li>
                        ))}
                      </ul>
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {q.subject ? <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{q.subject}{q.topic ? ` · ${q.topic}` : ""}</span> : subjectsReady && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">No subject</span>}
                        <span>{q.marks} mark{q.marks > 1 ? "s" : ""}{q.explanation && ` · ${q.explanation}`}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ) : (
          <p className="card p-10 text-center text-slate-500">Choose a test on the left, or create a new one.</p>
        )}
      </div>

      {testForm && (
        <TestForm
          test={testForm === "new" ? null : testForm}
          products={products}
          pending={pending}
          onClose={() => setTestForm(null)}
          onSubmit={(v) =>
            start(async () => {
              const res = await saveTest(v);
              if (!res.ok) return setMsg({ kind: "error", text: res.error });
              setMsg({ kind: "success", text: res.message ?? "Saved." });
              setTestForm(null);
              if (res.data?.id) setSelectedId(res.data.id);
              router.refresh();
            })
          }
        />
      )}
      {qForm && selected && (
        <QuestionForm
          question={qForm === "new" ? null : qForm}
          testId={selected.id}
          nextOrder={(qs.at(-1)?.sort_order ?? 0) + 1}
          pending={pending}
          onClose={() => setQForm(null)}
          onSubmit={(v) => run(() => saveQuestion(v), () => setQForm(null))}
          subjectsReady={subjectsReady}
        />
      )}
    </>
  );
}

function TestForm({ test, products, pending, onClose, onSubmit }: {
  test: AdminTest | null; products: Product[]; pending: boolean; onClose: () => void;
  onSubmit: (v: { id?: string; title: string; type: "mock" | "mcq"; duration_minutes: string; is_free: boolean; is_active: boolean; product_id: string | null }) => void;
}) {
  const [v, setV] = useState({
    title: test?.title ?? "", type: test?.type ?? ("mock" as "mock" | "mcq"), duration_minutes: String(test?.duration_minutes ?? 30),
    is_free: test?.is_free ?? false, is_active: test?.is_active ?? true, product_id: test?.product_id ?? "",
  });
  return (
    <Modal title={test ? "Edit test" : "New test"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: test?.id, product_id: v.product_id || null }); }} className="space-y-4">
        <div><Label htmlFor="tf-title">Title *</Label><input id="tf-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="input" required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tf-type">Type</Label>
            <select id="tf-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "mock" | "mcq" })} className="input">
              <option value="mock">Mock test</option><option value="mcq">MCQ practice</option>
            </select>
          </div>
          <div><Label htmlFor="tf-dur">Duration (minutes)</Label><input id="tf-dur" type="number" min={1} max={600} value={v.duration_minutes} onChange={(e) => setV({ ...v, duration_minutes: e.target.value })} className="input" required /></div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={v.is_free} onChange={(x) => setV({ ...v, is_free: x })} label="Free for everyone" />
          <Toggle checked={v.is_active} onChange={(x) => setV({ ...v, is_active: x })} label="Visible" />
        </div>
        <div>
          <Label htmlFor="tf-prod">Linked product {v.is_free ? "(optional)" : "* — buyers of this product can take the test"}</Label>
          <select id="tf-prod" value={v.product_id} onChange={(e) => setV({ ...v, product_id: e.target.value })} className="input">
            <option value="">— None —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save test</button>
        </div>
      </form>
    </Modal>
  );
}

function QuestionForm({ question, testId, nextOrder, pending, onClose, onSubmit, subjectsReady }: {
  question: AdminQuestion | null; testId: string; nextOrder: number; pending: boolean; onClose: () => void; onSubmit: (v: QuestionInput) => void; subjectsReady: boolean;
}) {
  const [v, setV] = useState({
    question: question?.question ?? "", options: question?.options ?? ["", "", "", ""], correct_option: question?.correct_option ?? 0,
    explanation: question?.explanation ?? "", marks: String(question?.marks ?? 1), subject: question?.subject ?? "", topic: question?.topic ?? "",
  });
  return (
    <Modal title={question ? "Edit question" : "Add question"} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const { subject, topic, ...rest } = v;
          onSubmit({ ...rest, ...(subjectsReady ? { subject, topic } : {}), id: question?.id, test_id: testId, sort_order: question?.sort_order ?? nextOrder });
        }}
        className="space-y-4"
      >
        <div><Label htmlFor="qf-q">Question *</Label><textarea id="qf-q" rows={3} value={v.question} onChange={(e) => setV({ ...v, question: e.target.value })} className="input" required /></div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-slate-700">Options * (tick the correct one)</legend>
          <div className="space-y-2">
            {v.options.map((o, i) => (
              <label key={i} className={`flex items-center gap-3 rounded-xl p-2 ring-1 ${v.correct_option === i ? "bg-green-50 ring-green-300" : "ring-slate-200"}`}>
                <input type="radio" name="correct" checked={v.correct_option === i} onChange={() => setV({ ...v, correct_option: i })} className="h-4 w-4 accent-green-600" aria-label={`Option ${LETTERS[i]} is correct`} />
                <span className="w-5 font-bold text-slate-500">{LETTERS[i]}</span>
                <input value={o} onChange={(e) => setV({ ...v, options: v.options.map((x, j) => (j === i ? e.target.value : x)) })} className="input !py-2" required aria-label={`Option ${LETTERS[i]}`} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div><Label htmlFor="qf-exp">Explanation (shown after submitting)</Label><input id="qf-exp" value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} className="input" /></div>
          <div><Label htmlFor="qf-marks">Marks</Label><input id="qf-marks" type="number" min={1} value={v.marks} onChange={(e) => setV({ ...v, marks: e.target.value })} className="input" required /></div>
        </div>
        {subjectsReady ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="qf-subject">Subject (for the student&apos;s subject-wise analysis)</Label>
              <select id="qf-subject" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} className="input">
                <option value="">— Not set —</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label htmlFor="qf-topic">Topic (optional)</Label><input id="qf-topic" value={v.topic} maxLength={100} onChange={(e) => setV({ ...v, topic: e.target.value })} className="input" placeholder="e.g. Kinematics, Organic chemistry" /></div>
          </div>
        ) : (
          <p className="text-xs text-amber-700">Run supabase/test-analytics.sql in Supabase to add Subject and Topic.</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save question</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- CSV bulk upload ----------
function CsvUpload({ testId, onDone }: { testId: string; onDone: (m: Msg) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<QuestionInput[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function read(file: File) {
    setError("");
    setRows(null);
    setFileName(file.name);
    try {
      setRows(csvToQuestions(await file.text(), testId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this CSV file.");
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="card border-2 border-dashed border-slate-200 p-5">
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">Bulk upload questions (CSV)</p>
          <p className="text-xs text-slate-500">Columns: question, option_a, option_b, option_c, option_d, correct_option (A–D), explanation, marks, subject, topic</p>
          <p className="text-xs text-slate-400">subject = {SUBJECTS.join(" / ")} (optional) · topic = any short text (optional)</p>
        </div>
        <button type="button" onClick={() => input.current?.click()} className="btn-light !px-4 !py-2 text-sm"><UploadIcon /> Choose CSV file</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      {rows && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-800"><strong>{rows.length}</strong> question(s) found in {fileName}.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRows(null)} className="btn-light !px-3 !py-1.5 text-xs">Cancel</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await bulkAddQuestions(testId, rows);
                onDone(res.ok ? { kind: "success", text: res.message ?? "Added." } : { kind: "error", text: res.error });
                if (res.ok) setRows(null);
              })}
              className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-60"
            >
              {pending ? "Adding…" : `Add ${rows.length} questions`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function csvToQuestions(text: string, testId: string): QuestionInput[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The file needs a header row plus at least one question.");
  const header = table[0].map((h) => h.trim().toLowerCase());
  const need = ["question", "option_a", "option_b", "option_c", "option_d", "correct_option"];
  const missing = need.filter((n) => !header.includes(n));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}. Download the sample CSV to see the format.`);
  const col = (r: string[], name: string) => (r[header.indexOf(name)] ?? "").trim();

  return table.slice(1).map((r) => {
    const raw = col(r, "correct_option").toUpperCase();
    const correct = LETTERS.includes(raw) ? LETTERS.indexOf(raw) : ["1", "2", "3", "4"].includes(raw) ? Number(raw) - 1 : -1;
    return {
      test_id: testId,
      question: col(r, "question"),
      options: [col(r, "option_a"), col(r, "option_b"), col(r, "option_c"), col(r, "option_d")],
      correct_option: correct,
      explanation: header.includes("explanation") ? col(r, "explanation") : "",
      marks: header.includes("marks") && col(r, "marks") ? col(r, "marks") : 1,
      ...(header.includes("subject") ? { subject: normaliseSubject(col(r, "subject")) || (col(r, "subject") ? `?${col(r, "subject")}` : "") } : {}),
      ...(header.includes("topic") ? { topic: col(r, "topic").slice(0, 100) } : {}),
    };
  });
}

// ---------- How students do on this test ----------
function StatsCard({ stat, total }: { stat: TestStats | null; total: number }) {
  const [all, setAll] = useState(false);
  if (!stat) return <div className="card p-5 text-sm text-slate-500">No attempts yet — statistics appear after students take this test.</div>;
  const missed = all ? stat.missed : stat.missed.slice(0, 5);
  return (
    <div className="card p-5">
      <h3 className="font-extrabold text-slate-900">How students are doing</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Attempts", String(stat.attempts)],
          ["Students", String(stat.students)],
          ["Average score", `${stat.avg_score}/${total} (${stat.avg_percent}%)`],
          ["Average time", formatDuration(stat.avg_seconds)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold text-slate-500">{k}</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm font-bold text-slate-800">Most-missed questions</p>
      {stat.missed.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Nobody has missed a question yet.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {missed.map((m) => (
            <li key={m.question_id} className="flex items-center gap-3 text-sm">
              <span className={`w-14 shrink-0 rounded-lg px-2 py-1 text-center text-xs font-extrabold ${m.wrong_percent >= 70 ? "bg-red-50 text-red-700" : m.wrong_percent >= 40 ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{m.wrong_percent}%</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-slate-800">{m.question}</span>
                <span className="text-xs text-slate-500">{m.wrong} of {stat.attempts} got it wrong{m.skipped ? ` (${m.skipped} skipped)` : ""}{m.subject ? ` · ${m.subject}${m.topic ? ` · ${m.topic}` : ""}` : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {stat.missed.length > 5 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-semibold text-brand-700 underline">{all ? "Show top 5" : `Show all ${stat.missed.length}`}</button>
      )}
    </div>
  );
}
