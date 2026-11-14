"use client";

// Admin → Success Stories. Real students only, with their consent.
// Photos go to the public picture storage (only after consent); deleting a story deletes its photo.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSuccessStory, saveSuccessStory, setStoryPublished, type StoryInput } from "@/app/admin/actions";
import { formatDateTime, initials } from "@/lib/format";
import { uploadPublicImage } from "@/lib/upload-image";
import { EditIcon, PlusIcon, TrashIcon, UploadIcon } from "../Icons";
import { Spinner } from "../Spinner";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminStory = {
  id: string; student_name: string; year: number | null; achievement: string; quote: string; photo_url: string | null; video_url: string | null;
  consent_at: string; is_published: boolean; sort_order: number; created_at: string;
};

export default function SuccessStoriesManager({ stories, setupMissing }: { stories: AdminStory[]; setupMissing: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminStory | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    });

  return (
    <>
      <AdminHeader title="Success Stories" subtitle="Real students who got their VIT campus and branch. Shown on the home page and /success-stories. Only add a student who agreed to be shown.">
        <button type="button" onClick={() => setEditing("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> Add story</button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/success-stories.sql in Supabase → SQL Editor first.</Notice></div>}
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {stories.length === 0 && !setupMissing && (
          <p className="card p-8 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
            No success stories yet. The section stays hidden on the website until you add one. Never add made-up or sample stories.
          </p>
        )}
        {stories.map((st) => (
          <article key={st.id} className="card flex flex-col p-5">
            <div className="flex items-center gap-3">
              {st.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={st.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{initials(st.student_name)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate font-extrabold text-slate-900">{st.student_name}{st.year ? <span className="ml-2 text-xs font-bold text-accent-700">{st.year}</span> : null}</p>
                <p className="truncate text-sm font-semibold text-brand-700">{st.achievement}</p>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 flex-1 text-sm text-slate-600">&ldquo;{st.quote}&rdquo;</p>
            {st.video_url && <a href={st.video_url} target="_blank" rel="noopener noreferrer" className="mt-2 truncate text-xs font-semibold text-brand-700 underline">{st.video_url}</a>}
            <p className="mt-2 text-xs font-semibold text-emerald-700">✓ Consent confirmed · {formatDateTime(st.consent_at)}</p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <Toggle checked={st.is_published} onChange={(v) => run(() => setStoryPublished(st.id, v))} label={st.is_published ? "Shown" : "Hidden"} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(st)} className="btn-light !px-3 !py-2" aria-label={`Edit ${st.student_name}`}><EditIcon /></button>
                <button
                  type="button"
                  onClick={() => { if (confirm(`Delete the story of ${st.student_name}? Its photo is deleted too. Use this when a student withdraws consent.`)) run(() => deleteSuccessStory(st.id)); }}
                  className="btn-light !px-3 !py-2 !text-red-600"
                  aria-label={`Delete ${st.student_name}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing && <StoryForm story={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setMsg({ kind: "success", text }); router.refresh(); }} />}
    </>
  );
}

function StoryForm({ story, onClose, onSaved }: { story: AdminStory | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState<StoryInput>({
    id: story?.id,
    student_name: story?.student_name ?? "",
    year: story?.year ? String(story.year) : String(new Date().getFullYear()),
    achievement: story?.achievement ?? "",
    quote: story?.quote ?? "",
    photo_url: story?.photo_url ?? "",
    video_url: story?.video_url ?? "",
    consent_confirmed: !!story, // existing stories always have consent
    is_published: story?.is_published ?? true,
    sort_order: String(story?.sort_order ?? 0),
  });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, start] = useTransition();
  const set = <K extends keyof StoryInput>(k: K, v: StoryInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!f.consent_confirmed) return setError("Tick the consent box first — only upload a photo the student agreed to share.");
    setError("");
    setUploading(true);
    try {
      set("photo_url", await uploadPublicImage(file, "stories"));
    } catch (e) {
      setError((e as Error).message);
    }
    setUploading(false);
  };

  return (
    <Modal title={story ? "Edit success story" : "Add success story"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            const res = await saveSuccessStory(f);
            if (!res.ok) return setError(res.error);
            onSaved(res.message ?? "Saved.");
          });
        }}
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
          <input type="checkbox" checked={f.consent_confirmed} onChange={(e) => set("consent_confirmed", e.target.checked)} disabled={!!story} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
          <span>
            <strong>Consent confirmed:</strong> this is a real student, and they (or a parent, if under 18) agreed that their name, result, quote{f.photo_url || f.video_url ? ", photo and video" : " and any photo or video"} can be shown on the EDUVORA website.
            {story && <span className="mt-1 block text-xs">Confirmed on {formatDateTime(story.consent_at)}. If they withdraw consent, delete the story.</span>}
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <Label htmlFor="ss-name">Student name *</Label>
            <input id="ss-name" value={f.student_name} onChange={(e) => set("student_name", e.target.value)} maxLength={80} className="input" placeholder="As they want it shown, e.g. Riya S." />
          </div>
          <div>
            <Label htmlFor="ss-year">Year</Label>
            <input id="ss-year" type="number" min={2000} max={2100} value={f.year} onChange={(e) => set("year", e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <Label htmlFor="ss-ach">What they achieved *</Label>
          <input id="ss-ach" value={f.achievement} onChange={(e) => set("achievement", e.target.value)} maxLength={120} className="input" placeholder="e.g. CSE, VIT Vellore" />
        </div>
        <div>
          <Label htmlFor="ss-quote">Short quote * ({f.quote.trim().length}/400) — their own words</Label>
          <textarea id="ss-quote" rows={3} value={f.quote} onChange={(e) => set("quote", e.target.value)} maxLength={400} className="input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ss-photo">Photo (optional)</Label>
            <div className="flex items-center gap-3">
              {f.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : null}
              <label className={`btn-light cursor-pointer !px-3 !py-2 text-sm ${uploading ? "opacity-60" : ""}`}>
                {uploading ? <Spinner /> : <UploadIcon />} {f.photo_url ? "Change" : "Upload"}
                <input id="ss-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              {f.photo_url && <button type="button" onClick={() => set("photo_url", "")} className="text-sm font-semibold text-red-600 underline">Remove</button>}
            </div>
          </div>
          <div>
            <Label htmlFor="ss-video">Video link (optional)</Label>
            <input id="ss-video" value={f.video_url} onChange={(e) => set("video_url", e.target.value)} className="input" placeholder="https://youtu.be/…" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Toggle checked={f.is_published} onChange={(v) => set("is_published", v)} label="Show on website" />
          <div className="flex items-center gap-2">
            <Label htmlFor="ss-order">Order</Label>
            <input id="ss-order" type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="input !w-24" />
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={saving || uploading || !f.consent_confirmed} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
