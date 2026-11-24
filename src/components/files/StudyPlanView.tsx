"use client";

import { useEffect, useRef, useState } from "react";
import { setPlanDayDone, setPlanStart } from "@/lib/study-plan-actions";
import { addDays, todayDayNumber, type PlanDay } from "@/lib/study-plan";
import { formatDate } from "@/lib/format";
import { CheckIcon, DownloadIcon, ExternalIcon } from "../Icons";
import SaveError, { safeSave, type SaveFailure } from "./SaveError";

// A course's day-wise study plan for the student: start date (theirs, or the
// enrolment date), progress bar, today's day highlighted, "Mark day as done",
// linked PDFs (Open PDF → the server checks access), and a printable PDF.
export default function StudyPlanView({
  productId, days, done: initialDone, start, defaultStart, today, fileNames,
}: {
  productId: string; days: PlanDay[]; done: string[]; start: string; defaultStart: string; today: string; fileNames: Record<string, string>;
}) {
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [startDate, setStartDate] = useState(start);
  const [error, setError] = useState<SaveFailure | null>(null);
  const [saving, setSaving] = useState("");
  const todayRef = useRef<HTMLLIElement>(null);
  const todayN = todayDayNumber(startDate, today);
  const pct = days.length ? Math.round((days.filter((d) => done.has(d.id)).length / days.length) * 100) : 0;

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  async function toggle(d: PlanDay, value: boolean) {
    setError(null);
    setSaving(d.id);
    setDone((s) => {
      const n = new Set(s);
      if (value) n.add(d.id);
      else n.delete(d.id);
      return n;
    });
    const r = await safeSave("mark-day-done", () => setPlanDayDone(d.id, value), { dayId: d.id });
    setSaving("");
    if (!r.ok) {
      setError({ message: r.error, again: () => void toggle(d, value) });
      setDone((s) => {
        const n = new Set(s);
        if (value) n.delete(d.id);
        else n.add(d.id);
        return n;
      });
    }
  }
  async function changeStart(v: string | null) {
    const before = startDate;
    setError(null);
    setStartDate(v ?? defaultStart);
    const r = await safeSave("plan-start-date", () => setPlanStart(productId, v), { productId });
    if (!r.ok) {
      setStartDate(before);
      setError({ message: r.error, again: () => void changeStart(v) });
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-bold text-slate-800">Study plan progress</span>
            <span className="text-slate-600"><strong className="text-slate-900">{pct}%</strong> · {done.size} of {days.length} days done</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Study plan progress">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-accent-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {todayN < 1 ? `Your plan starts on ${formatDate(startDate, true)}.` : todayN > days.length ? "You've reached the end of the plan — great work!" : <>Today is <strong>Day {todayN}</strong>.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-slate-600">
            My start date
            <input type="date" value={startDate} onChange={(e) => e.target.value && void changeStart(e.target.value)} className="input mt-1 !py-1.5 text-sm" />
          </label>
          {startDate !== defaultStart && <button type="button" onClick={() => void changeStart(null)} className="pb-2 text-xs font-semibold text-brand-700 underline">Reset</button>}
          <a href={`/api/study-plan/${productId}/pdf`} className="btn-light !px-3 !py-2 text-sm"><DownloadIcon className="h-4 w-4" /> Printable PDF</a>
        </div>
      </div>
      <SaveError failure={error} />

      <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {days.map((d) => {
          const isDone = done.has(d.id);
          const isToday = d.day_number === todayN;
          return (
            <li key={d.id} ref={isToday ? todayRef : undefined} className={`rounded-xl p-3 ring-1 ${isToday ? "bg-accent-400/10 ring-2 ring-accent-400" : isDone ? "bg-emerald-50/60 ring-emerald-200" : "bg-white ring-slate-200"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className={`grid h-11 w-14 shrink-0 place-items-center rounded-xl text-center text-xs font-extrabold leading-tight text-white ${isDone ? "bg-emerald-600" : "bg-brand-600"}`}>
                  {isDone ? <CheckIcon className="h-5 w-5" /> : <>Day<br />{d.day_number}</>}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold text-slate-900">
                    {isToday && <span className="mr-1.5 rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand-950">Today</span>}
                    {d.is_sample && <span className="mr-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">Sample</span>}
                    Day {d.day_number}{d.subjects.length ? ` · ${d.subjects.join(", ")}` : ""}
                    <span className="ml-2 text-xs font-normal text-slate-500">{formatDate(addDays(startDate, d.day_number - 1), true)}</span>
                  </p>
                  {d.topics.length > 0 && <ul className="mt-1 list-disc pl-5 text-slate-700">{d.topics.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                  {d.note && <p className="mt-1 text-xs text-slate-500">{d.note}</p>}
                  {d.file_ids.some((id) => fileNames[id]) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.file_ids.filter((id) => fileNames[id]).map((id) => (
                        <a key={id} href={`/api/files/${id}/open`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100">
                          <ExternalIcon className="h-3.5 w-3.5" /> {fileNames[id]}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={isDone} disabled={saving === d.id} onChange={(e) => void toggle(d, e.target.checked)} className="h-5 w-5 accent-emerald-600" />
                  {isDone ? "Done" : "Mark day as done"}
                </label>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
