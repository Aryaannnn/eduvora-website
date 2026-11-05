"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteReview, saveReview, setReviewApproved, type ReviewInput } from "@/app/admin/actions";
import { formatDateTime, initials } from "@/lib/format";
import Stars from "../Stars";
import { EditIcon, PlusIcon, TrashIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminReview = { id: string; name: string; type: "student" | "parent"; rating: number; comment: string; photo_url: string | null; is_approved: boolean; created_at: string };

export default function ReviewsManager({ reviews }: { reviews: AdminReview[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "approved" | "waiting">("all");
  const [editing, setEditing] = useState<AdminReview | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const shown = reviews.filter((r) => filter === "all" || (filter === "approved" ? r.is_approved : !r.is_approved));
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (res.message ? { kind: "success", text: res.message } : null) : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) { after?.(); router.refresh(); }
    });

  return (
    <>
      <AdminHeader title="Reviews" subtitle="Only approved reviews appear on the website.">
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input !w-auto" aria-label="Filter reviews">
          <option value="all">All ({reviews.length})</option>
          <option value="approved">Approved ({reviews.filter((r) => r.is_approved).length})</option>
          <option value="waiting">Waiting ({reviews.filter((r) => !r.is_approved).length})</option>
        </select>
        <button type="button" onClick={() => setEditing("new")} className="btn-primary"><PlusIcon /> Add review</button>
      </AdminHeader>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {shown.length === 0 ? (
        <p className="card p-10 text-center text-slate-500">No reviews here.</p>
      ) : (
        <ul className={`grid gap-4 md:grid-cols-2 ${pending ? "opacity-60" : ""}`}>
          {shown.map((r) => (
            <li key={r.id} className={`card flex flex-col p-5 ${r.is_approved ? "" : "ring-2 ring-amber-200"}`}>
              <div className="flex items-center gap-3">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials(r.name)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{r.name}</p>
                  <p className="text-xs capitalize text-slate-500">{r.type} · {formatDateTime(r.created_at)}</p>
                </div>
                <Stars rating={r.rating} />
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-700">“{r.comment}”</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <Toggle checked={r.is_approved} onChange={(v) => run(() => setReviewApproved(r.id, v))} label={r.is_approved ? "Approved (shown)" : "Not approved (hidden)"} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(r)} className="btn-light !px-3 !py-1.5 text-xs"><EditIcon /> Edit</button>
                  <button type="button" onClick={() => confirm(`Delete the review by ${r.name}?`) && run(() => deleteReview(r.id))} className="btn-light !px-3 !py-1.5 text-xs !text-red-600"><TrashIcon /> Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ReviewForm review={editing === "new" ? null : editing} pending={pending} onClose={() => setEditing(null)} onSubmit={(v) => run(() => saveReview(v), () => setEditing(null))} />
      )}
    </>
  );
}

function ReviewForm({ review, pending, onClose, onSubmit }: { review: AdminReview | null; pending: boolean; onClose: () => void; onSubmit: (v: ReviewInput) => void }) {
  const [v, setV] = useState({
    name: review?.name ?? "", type: review?.type ?? ("student" as "student" | "parent"), rating: review?.rating ?? 5,
    comment: review?.comment ?? "", photo_url: review?.photo_url ?? "", is_approved: review?.is_approved ?? true,
  });
  return (
    <Modal title={review ? "Edit review" : "Add review"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...v, id: review?.id }); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="rf-name">Name *</Label><input id="rf-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className="input" required /></div>
          <div>
            <Label htmlFor="rf-type">Who</Label>
            <select id="rf-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "student" | "parent" })} className="input">
              <option value="student">Student</option><option value="parent">Parent</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-slate-700">Rating</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setV({ ...v, rating: n })} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={v.rating === n}
                className={`text-3xl leading-none ${n <= v.rating ? "text-accent-500" : "text-slate-300"}`}>★</button>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="rf-comment">Review *</Label><textarea id="rf-comment" rows={4} value={v.comment} onChange={(e) => setV({ ...v, comment: e.target.value })} className="input" required /></div>
        <div><Label htmlFor="rf-photo">Photo link (optional)</Label><input id="rf-photo" value={v.photo_url} onChange={(e) => setV({ ...v, photo_url: e.target.value })} className="input" placeholder="https://…" /></div>
        <Toggle checked={v.is_approved} onChange={(x) => setV({ ...v, is_approved: x })} label="Approved — show on website" />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">Save review</button>
        </div>
      </form>
    </Modal>
  );
}
