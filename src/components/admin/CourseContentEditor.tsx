"use client";

// Admin → Products → (crash course) → "Course page".
// Plain form fields for everything on the course page. They are saved inside the
// product's "extra display info" (details) — the same JSON shown under Advanced,
// so both always match. Lists: ONE item per line.
import { PlusIcon, TrashIcon } from "../Icons";
import { Label } from "./ui";

type Details = Record<string, unknown>;

const lines = (v: unknown) => (Array.isArray(v) ? v.map(String).join("\n") : "");
const toList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function CourseContentEditor({ json, onChange }: { json: string; onChange: (json: string) => void }) {
  let d: Details;
  try {
    const parsed = JSON.parse(json || "{}");
    d = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
        The &ldquo;Extra display info&rdquo; under Advanced isn&apos;t valid JSON right now — fix it there to edit the course page here.
      </p>
    );
  }
  const put = (patch: Details) => {
    const next: Details = { ...d, ...patch };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k]; // empty = hidden on the page
    }
    onChange(JSON.stringify(next, null, 2));
  };
  const delivery = (d.delivery && typeof d.delivery === "object" ? d.delivery : {}) as { live?: string; recording?: string; pdf?: string };
  const putDelivery = (k: "live" | "recording" | "pdf", v: string) => {
    const nd = { ...delivery, [k]: v };
    if (!v.trim()) delete nd[k];
    put({ delivery: Object.keys(nd).length ? nd : undefined });
  };
  const faqs = (Array.isArray(d.faqs) ? d.faqs : []) as { q: string; a: string }[];
  const putFaqs = (f: { q: string; a: string }[]) => put({ faqs: f.length ? f : undefined });

  const area = (id: string, label: string, key: string, placeholder: string, rows = 3) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} rows={rows} defaultValue={lines(d[key])} onBlur={(e) => put({ [key]: toList(e.target.value) })} className="input" placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Empty boxes are simply not shown on the course page. Lists: one item per line.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="cc-start">Start date</Label>
          <input id="cc-start" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(String(d.start_date ?? "")) ? String(d.start_date) : ""} onChange={(e) => put({ start_date: e.target.value })} className="input" />
          {d.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.start_date)) ? <p className="mt-1 text-xs text-slate-500">Now: &ldquo;{String(d.start_date)}&rdquo; — pick a date to replace it.</p> : null}
        </div>
        <div>
          <Label htmlFor="cc-dur">Duration</Label>
          <input id="cc-dur" defaultValue={String(d.duration ?? "")} onBlur={(e) => put({ duration: e.target.value.trim() })} className="input" placeholder="e.g. 45 days" />
        </div>
        <div>
          <Label htmlFor="cc-seats">Seat limit (empty = no limit)</Label>
          <input id="cc-seats" type="number" min={1} step={1} inputMode="numeric" value={d.seat_limit ? String(d.seat_limit) : ""} onChange={(e) => { const n = Math.floor(Number(e.target.value)); put({ seat_limit: e.target.value && n > 0 ? n : undefined }); }} className="input" placeholder="e.g. 60" />
          <p className="mt-1 text-xs text-slate-500">Shows &ldquo;X seats left&rdquo; (paid enrolments only). Full = no more payments.</p>
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="cc-mode">Mode (short)</Label>
          <input id="cc-mode" defaultValue={String(d.mode ?? "")} onBlur={(e) => put({ mode: e.target.value.trim() })} className="input" placeholder="e.g. Online live + recordings" />
        </div>
      </div>

      {area("cc-who", "Who this is for", "who_for", "Class 12 students taking VITEEE 2027\nDroppers who want a fast revision")}
      {area("cc-learn", "What you will learn", "learn", "Shortcuts for Maths and Physics\nHow to attempt the paper in 2.5 hours", 4)}
      {area("cc-sched", "Schedule and timings", "schedule", "Mon – Sat, 7:00 – 9:00 PM IST\nSunday: full mock test, 10 AM")}

      <div>
        <Label>How classes are delivered (empty = not shown)</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["live", "Live classes", "Live on Google Meet — link in your dashboard"],
            ["recording", "Recordings", "Every class recorded, available within 24 h"],
            ["pdf", "PDF notes", "Chapter-wise PDF notes to download"],
          ] as const).map(([k, label, ph]) => (
            <div key={k}>
              <label htmlFor={`cc-del-${k}`} className="mb-1 block text-xs font-bold text-slate-600">{label}</label>
              <input id={`cc-del-${k}`} defaultValue={delivery[k] ?? ""} onBlur={(e) => putDelivery(k, e.target.value.trim())} className="input" placeholder={ph} />
            </div>
          ))}
        </div>
      </div>

      {area("cc-after", "What you get after payment", "after_payment", "Instant access in My Courses\nClass links + WhatsApp group invite\nInvoice by email")}
      {area("cc-feat", "Key features (optional)", "features", "Daily doubt solving\nWeekly mock tests")}

      <div>
        <Label>Questions about this course (FAQ)</Label>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={`${i}-${faqs.length}`} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex gap-2">
                <input defaultValue={f.q} onBlur={(e) => putFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value.trim() } : x)))} className="input" placeholder="Question" aria-label={`Question ${i + 1}`} />
                <button type="button" onClick={() => putFaqs(faqs.filter((_, j) => j !== i))} className="btn-light !px-3 !text-red-600" aria-label={`Remove question ${i + 1}`}><TrashIcon /></button>
              </div>
              <textarea rows={2} defaultValue={f.a} onBlur={(e) => putFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value.trim() } : x)))} className="input mt-2" placeholder="Answer" aria-label={`Answer ${i + 1}`} />
            </div>
          ))}
          <button type="button" onClick={() => putFaqs([...faqs, { q: "", a: "" }])} className="btn-light !px-3 !py-2 text-sm"><PlusIcon /> Add question</button>
        </div>
      </div>
    </div>
  );
}
