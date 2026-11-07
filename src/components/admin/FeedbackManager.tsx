"use client";

// Admin → Feedback: every post-session feedback, the average rating, and
// one-click "Publish as review" when the student gave permission.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteFeedback, publishFeedbackAsReview } from "@/app/admin/actions";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import Stars from "../Stars";
import { CheckIcon, TrashIcon } from "../Icons";
import { AdminHeader, downloadCsv, Notice } from "./ui";

export type AdminFeedback = {
  id: string; rating: number; helped_most: string | null; improve: string | null; allow_public: boolean; consent_at: string | null;
  review_id: string | null; created_at: string;
  bookings: { name: string; email: string | null; phone: string; slots: { date: string; start_time: string } | null } | null;
};

type Filter = "all" | "publishable" | "published" | "low";

export default function FeedbackManager({ feedback }: { feedback: AdminFeedback[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const canPublish = (f: AdminFeedback) => f.allow_public && !f.review_id && (f.helped_most?.length ?? 0) >= 10;
  const shown = feedback.filter((f) =>
    filter === "all" ? true : filter === "publishable" ? canPublish(f) : filter === "published" ? !!f.review_id : f.rating <= 3,
  );
  const count = feedback.length;
  const avg = count ? feedback.reduce((s, f) => s + f.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: feedback.filter((f) => f.rating === n).length }));

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Done." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    });

  const publish = (f: AdminFeedback) => {
    const first = (f.bookings?.name ?? "Student").split(" ")[0];
    const name = prompt(`Publish this as an approved review on the website?\n\nShown: name, ${f.rating}★ and "What helped you most?".\n"What can we improve?" stays private.\n\nName to show:`, first);
    if (name === null) return;
    run(() => publishFeedbackAsReview(f.id, name));
  };
  const remove = (f: AdminFeedback) => {
    if (!confirm(`Delete this feedback from ${f.bookings?.name ?? "the student"}? (A review already published from it stays — delete that in Reviews.)`)) return;
    run(() => deleteFeedback(f.id));
  };
  const exportCsv = () =>
    downloadCsv(
      "session-feedback.csv",
      ["Date", "Student", "Email", "Session", "Rating", "What helped most", "What can we improve", "May show as review", "Published"],
      feedback.map((f) => [
        f.created_at.slice(0, 10), f.bookings?.name ?? "", f.bookings?.email ?? "",
        f.bookings?.slots ? `${f.bookings.slots.date} ${f.bookings.slots.start_time.slice(0, 5)}` : "",
        f.rating, f.helped_most ?? "", f.improve ?? "", f.allow_public ? "yes" : "no", f.review_id ? "yes" : "no",
      ]),
    );

  return (
    <>
      <AdminHeader title="Feedback" subtitle="Sent by students after their counselling session (email 1 hour after the session, or from My Bookings).">
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="input !w-auto" aria-label="Filter feedback">
          <option value="all">All ({count})</option>
          <option value="publishable">Can publish ({feedback.filter(canPublish).length})</option>
          <option value="published">Published ({feedback.filter((f) => f.review_id).length})</option>
          <option value="low">3★ or less ({feedback.filter((f) => f.rating <= 3).length})</option>
        </select>
        {count > 0 && <button type="button" onClick={exportCsv} className="btn-light">Download CSV</button>}
      </AdminHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="card flex flex-col items-center justify-center px-8 py-5 text-center">
          <p className="text-sm font-semibold text-slate-500">Average rating</p>
          <p className="mt-1 text-4xl font-extrabold text-slate-900">{count ? avg.toFixed(1) : "—"}<span className="text-lg text-slate-400"> / 5</span></p>
          <div className="mt-1"><Stars rating={avg} /></div>
          <p className="mt-1 text-xs text-slate-500">{count} feedback{count === 1 ? "" : "s"}</p>
        </div>
        <div className="card space-y-1.5 p-5">
          {dist.map(({ n, c }) => (
            <div key={n} className="flex items-center gap-3 text-sm">
              <span className="w-8 font-semibold text-slate-600">{n}★</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${count ? (c / count) * 100 : 0}%` }} />
              </span>
              <span className="w-8 text-right text-slate-500">{c}</span>
            </div>
          ))}
        </div>
      </div>

      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">{count === 0 ? "No feedback yet. Students get the feedback email 1 hour after their session ends." : "No feedback here."}</p>
      ) : (
        <ul className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
          {shown.map((f) => (
            <li key={f.id} className={`card p-5 ${f.rating <= 2 ? "ring-2 ring-red-200" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={f.rating} />
                    <p className="font-bold text-slate-900">{f.bookings?.name ?? "Student"}</p>
                    {f.allow_public ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">May show as review</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Private</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {f.bookings?.slots ? `Session ${formatDate(f.bookings.slots.date)}, ${formatTime(f.bookings.slots.start_time)} · ` : ""}sent {formatDateTime(f.created_at)}
                    {f.bookings?.email ? ` · ${f.bookings.email}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {f.review_id ? (
                    <Link href="/admin/reviews" className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-4 w-4" /> Published</Link>
                  ) : canPublish(f) ? (
                    <button type="button" onClick={() => publish(f)} disabled={pending} className="btn-primary !px-4 !py-2 text-sm">Publish as review</button>
                  ) : f.allow_public ? (
                    <span className="text-xs text-slate-500">No comment to publish</span>
                  ) : null}
                  <button type="button" onClick={() => remove(f)} disabled={pending} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete feedback"><TrashIcon /></button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">What helped most</p>
                  <p className="mt-1 whitespace-pre-line text-slate-800">{f.helped_most ?? <span className="text-slate-400">—</span>}</p>
                </div>
                <div className="rounded-xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">What can we improve (private)</p>
                  <p className="mt-1 whitespace-pre-line text-slate-800">{f.improve ?? <span className="text-slate-400">—</span>}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
