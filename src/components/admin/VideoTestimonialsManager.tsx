"use client";

// Admin → Reviews → Video testimonials
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteVideoTestimonial, saveVideoTestimonial, setVideoPublished, type VideoInput } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/format";
import { youtubeId, youtubeThumb } from "@/lib/youtube";
import { EditIcon, PlusIcon, TrashIcon } from "../Icons";
import { Label, Modal, Notice, Toggle } from "./ui";

export type AdminVideo = {
  id: string; youtube_id: string; student_name: string; achievement: string | null; year: number | null;
  consent_confirmed: boolean; consent_at: string | null; is_published: boolean; sort_order: number; created_at: string;
};

export default function VideoTestimonialsManager({ videos, setupMissing }: { videos: AdminVideo[]; setupMissing: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminVideo | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (res.message ? { kind: "success", text: res.message } : null) : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <section id="videos" className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Video testimonials</h2>
          <p className="text-sm text-slate-500">YouTube videos shown on the home page and Reviews page. Only videos with the student&apos;s consent can be shown.</p>
        </div>
        <button type="button" onClick={() => setEditing("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> Add video</button>
      </div>
      {setupMissing && <div className="mt-4"><Notice kind="error">Run supabase/video-testimonials.sql in Supabase → SQL Editor first.</Notice></div>}
      {msg && <div className="mt-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {videos.length === 0 && !setupMissing && <p className="card p-8 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">No video testimonials yet. The section stays hidden on the website until you add one.</p>}
        {videos.map((v) => (
          <article key={v.id} className="card overflow-hidden">
            <a href={`https://youtu.be/${v.youtube_id}`} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-slate-900">
              <Image src={youtubeThumb(v.youtube_id)} alt={`Video by ${v.student_name}`} fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
            </a>
            <div className="p-4">
              <p className="font-extrabold text-slate-900">{v.student_name}{v.year ? <span className="ml-2 text-xs font-bold text-accent-700">{v.year}</span> : null}</p>
              {v.achievement && <p className="text-sm font-semibold text-brand-700">{v.achievement}</p>}
              <p className={`mt-2 text-xs font-semibold ${v.consent_confirmed ? "text-emerald-700" : "text-rose-700"}`}>
                {v.consent_confirmed ? `✓ Consent confirmed${v.consent_at ? ` · ${formatDateTime(v.consent_at)}` : ""}` : "✗ No consent yet — can't be shown"}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Toggle checked={v.is_published} onChange={(val) => run(() => setVideoPublished(v.id, val))} label={v.is_published ? "Shown" : "Hidden"} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(v)} className="btn-light !px-2.5 !py-1.5" aria-label={`Edit ${v.student_name}`}><EditIcon /></button>
                  <button type="button" onClick={() => confirm(`Delete the video by ${v.student_name}?`) && run(() => deleteVideoTestimonial(v.id))} className="btn-light !px-2.5 !py-1.5 !text-red-600" aria-label={`Delete ${v.student_name}`}><TrashIcon /></button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing && <VideoForm v={editing === "new" ? null : editing} pending={pending} onClose={() => setEditing(null)} onSave={(val) => run(() => saveVideoTestimonial(val), () => setEditing(null))} />}
    </section>
  );
}

function VideoForm({ v, pending, onClose, onSave }: { v: AdminVideo | null; pending: boolean; onClose: () => void; onSave: (val: VideoInput) => void }) {
  const [f, setF] = useState({
    youtube: v ? `https://youtu.be/${v.youtube_id}` : "",
    student_name: v?.student_name ?? "",
    achievement: v?.achievement ?? "",
    year: v?.year ? String(v.year) : String(new Date().getFullYear()),
    consent_confirmed: v?.consent_confirmed ?? false,
    is_published: v?.is_published ?? true,
    sort_order: String(v?.sort_order ?? 0),
  });
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  const id = youtubeId(f.youtube);

  return (
    <Modal title={v ? "Edit video testimonial" : "Add video testimonial"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ id: v?.id, ...f }); }}>
        <div>
          <Label htmlFor="v-url">YouTube link *</Label>
          <input id="v-url" value={f.youtube} onChange={(e) => set("youtube", e.target.value)} className="input" placeholder="https://youtu.be/…  or  https://www.youtube.com/watch?v=…" required />
          {f.youtube && !id && <p className="mt-1 text-xs font-semibold text-red-600">That doesn&apos;t look like a YouTube video link.</p>}
          {id && (
            <div className="relative mt-2 aspect-video overflow-hidden rounded-xl bg-slate-900">
              <Image src={youtubeThumb(id)} alt="Video preview" fill sizes="28rem" className="object-cover" />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Tip: upload as &quot;Unlisted&quot; on YouTube if you don&apos;t want it in YouTube search.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="v-name">Student name *</Label><input id="v-name" value={f.student_name} onChange={(e) => set("student_name", e.target.value)} className="input" maxLength={80} required /></div>
          <div><Label htmlFor="v-year">Year</Label><input id="v-year" type="number" min={2000} max={2100} inputMode="numeric" value={f.year} onChange={(e) => set("year", e.target.value)} className="input" /></div>
        </div>
        <div><Label htmlFor="v-got">What they got</Label><input id="v-got" value={f.achievement} onChange={(e) => set("achievement", e.target.value)} className="input" placeholder="e.g. CSE, VIT Vellore" maxLength={120} /></div>
        <div><Label htmlFor="v-order">Order (lower = first)</Label><input id="v-order" type="number" inputMode="numeric" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="input" /></div>

        <label className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm ring-1 ${f.consent_confirmed ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200"}`}>
          <input type="checkbox" checked={f.consent_confirmed} onChange={(e) => set("consent_confirmed", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
          <span>
            <strong>I confirm the student (and a parent, if under 18) agreed</strong> to this video being shown on the EDUVORA website with their name and result.
          </span>
        </label>
        <Toggle checked={f.is_published && f.consent_confirmed} onChange={(val) => set("is_published", val)} label="Show on the website" />
        {!f.consent_confirmed && <p className="text-xs text-slate-500">Without consent the video is saved but stays hidden.</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending || !id} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save video"}</button>
        </div>
      </form>
    </Modal>
  );
}
