"use client";

// =====================================================================
//  ADMIN → PRODUCT FILES (PDF / ZIP)
//  Drag & drop or "Choose files" · progress bar per file · rename ·
//  replace · delete · preview (PDF) · drag rows to change the order.
//  Crash courses: a subject (Physics / Chemistry / Mathematics) and a
//  chapter / day per PDF. Any PDF: "Move to" another product (tick several
//  to move them together) — logged in the Activity Log.
//  Files go straight from your browser to the PRIVATE Supabase bucket
//  using a one-time upload link from the server (admin checked there).
// =====================================================================
import { useEffect, useRef, useState } from "react";
import {
  deleteProductFile,
  finishFileUpload,
  listFileDestinations,
  listProductFiles,
  moveProductFiles,
  renameProductFile,
  reorderProductFiles,
  startFileUpload,
  updateFileInfo,
  type FileDestination,
} from "@/app/admin/file-actions";
import { siteConfig } from "@/config/site";
import { processPdfPages, type PagesProgress } from "@/lib/process-pages-client";
import { formatDateTime } from "@/lib/format";
import { checkFile, formatBytes, subjectLabel, subjectsForSlug, type ProductFile } from "@/lib/product-files";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { CheckIcon, DownloadIcon, EditIcon, TrashIcon, UploadIcon } from "../Icons";
import { SUBJECT_UI, subjectKeysFor } from "../courses/SubjectIcon";

type Upload = { key: string; name: string; size: number; progress: number; status: "uploading" | "done" | "error"; error?: string };

/** PUT the file to Supabase with a progress bar (fetch can't report upload progress, XHR can). */
function putWithProgress(path: string, token: string, file: File, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/upload/sign/materials/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", new File([file], file.name, { type: contentType })); // exact type (Windows sometimes sends none for .zip)
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try {
        const j = JSON.parse(xhr.responseText);
        msg = j.message || j.error || msg;
      } catch {
        /* keep default */
      }
      if (/maximum allowed size|too large|413/i.test(msg) || xhr.status === 413) msg = `File is larger than the Supabase limit (${siteConfig.uploads.maxFileMB} MB).`;
      if (/mime type/i.test(msg)) msg = "Only PDF and ZIP files are allowed.";
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error — check your internet and try again."));
    xhr.send(body);
  });
}

const Badge = ({ kind }: { kind: "pdf" | "zip" }) => (
  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white ${kind === "pdf" ? "bg-red-500" : "bg-amber-500"}`}>{kind.toUpperCase()}</span>
);

export default function FilesManager({ productId, category = "", slug = "" }: { productId: string; category?: string; slug?: string }) {
  const bySubject = category === "crash_course"; // PDFs filed under Physics / Chemistry / Mathematics (+ English & Aptitude)
  // The four crash courses: 4 subjects. Formula Book and Question Bank: Physics, Chemistry, Mathematics only.
  const SUBJECT_KEYS = subjectKeysFor(slug);
  const subjectOptions = subjectsForSlug(slug);
  const withChapter = category === "crash_course" || category === "question_bank";
  const uploadSubject = useRef(""); // which subject area's "Choose files" was clicked
  const [selected, setSelected] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<FileDestination[] | null>(null);
  const [bulkTo, setBulkTo] = useState("");
  const [files, setFiles] = useState<ProductFile[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]); // big files (they still upload)
  const [dragOver, setDragOver] = useState<string | null>(null); // which drop area
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  const chooser = useRef<HTMLInputElement>(null);
  const replacer = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string>("");

  useEffect(() => {
    let alive = true;
    listProductFiles(productId).then((r) => {
      if (!alive) return;
      if (r.ok) setFiles(r.data?.files ?? []);
      else {
        setFiles([]);
        setErrors([r.error]);
      }
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  useEffect(() => {
    let alive = true;
    listFileDestinations().then((r) => alive && setDestinations(r.ok ? r.data?.destinations ?? [] : []));
    return () => {
      alive = false;
    };
  }, [productId]);

  const patchUpload = (key: string, p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));

  // ---- Fast reader: turn a PDF's pages into WebP pictures (progress per file) ----
  const [preparing, setPreparing] = useState<Record<string, PagesProgress>>({});
  const patchFile = (id: string, p: Partial<ProductFile>) => setFiles((fs) => (fs ?? []).map((f) => (f.id === id ? { ...f, ...p } : f)));
  async function preparePages(id: string) {
    setPreparing((m) => ({ ...m, [id]: { done: 0, total: 0 } }));
    patchFile(id, { pages_status: "processing", pages_error: null });
    try {
      const r = await processPdfPages(id, (p) => setPreparing((m) => ({ ...m, [id]: p })));
      patchFile(id, { pages_status: "ready", page_count: r.pages, pages_done: r.pages, pages_bytes: r.bytes });
    } catch (e) {
      patchFile(id, { pages_status: "failed", pages_error: (e as Error).message });
    } finally {
      setPreparing((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
    }
  }

  async function uploadOne(file: File, replaceId?: string, subject = "") {
    const key = `${file.name}-${file.size}-${crypto.randomUUID()}`;
    setUploads((u) => [...u, { key, name: file.name, size: file.size, progress: 0, status: "uploading" }]);
    try {
      const start = await startFileUpload(productId, file.name, file.size, file.type);
      if (!start.ok) throw new Error(start.error);
      await putWithProgress(start.data!.path, start.data!.token, file, start.data!.contentType, (p) => patchUpload(key, { progress: p }));
      const done = await finishFileUpload({ productId, path: start.data!.path, fileName: file.name, size: file.size, replaceId, subject: bySubject && subject ? subject : undefined });
      if (!done.ok) throw new Error(done.error);
      const saved = done.data!.file;
      setFiles((fs) => (replaceId ? (fs ?? []).map((f) => (f.id === replaceId ? saved : f)) : [...(fs ?? []), saved]));
      patchUpload(key, { progress: 100, status: "done" });
      if (done.message) setNotice(done.message); // e.g. "already stored — the existing copy is reused"
      setTimeout(() => setUploads((u) => u.filter((x) => x.key !== key)), 4000);
      if (saved.file_type === "pdf" && siteConfig.inWebsiteReader) void preparePages(saved.id); // pages → WebP for the in-website reader (once)
    } catch (e) {
      patchUpload(key, { status: "error", error: (e as Error).message });
    }
  }

  function addFiles(list: FileList | File[], subject = "") {
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const p = checkFile(f.name, f.size, f.type); // checked BEFORE uploading
      if (p) problems.push(p);
      else ok.push(f);
    }
    setErrors(problems);
    setNotice("");
    const big = ok.filter((f) => f.size > siteConfig.uploads.warnFileMB * 1024 * 1024);
    setWarnings(
      big.map((f) => `"${f.name}" is ${formatBytes(f.size)} — larger than ${siteConfig.uploads.warnFileMB} MB. It uploads, but uses a lot of storage and is slow for students on mobile data. Consider compressing the PDF (e.g. "Reduce file size" in your PDF app) and using Replace.`),
    );
    ok.forEach((f) => void uploadOne(f, undefined, subject));
  }

  async function replace(file: File) {
    const id = replaceTarget.current;
    const p = checkFile(file.name, file.size, file.type);
    if (p) return setErrors([p]);
    setErrors([]);
    await uploadOne(file, id);
  }

  async function remove(f: ProductFile) {
    if (!confirm(`Delete "${f.display_name}"? Students will no longer be able to download it. This cannot be undone.`)) return;
    setBusyId(f.id);
    const r = await deleteProductFile(f.id);
    setBusyId("");
    if (!r.ok) return setErrors([r.error]);
    setFiles((fs) => (fs ?? []).filter((x) => x.id !== f.id));
    setNotice("File deleted.");
  }

  async function saveRename() {
    if (!renaming) return;
    const r = await renameProductFile(renaming.id, renaming.name);
    if (!r.ok) return setErrors([r.error]);
    setFiles((fs) => (fs ?? []).map((x) => (x.id === renaming.id ? { ...x, display_name: renaming.name.trim() } : x)));
    setRenaming(null);
  }

  async function saveInfo(f: ProductFile, info: { subject?: string | null; chapter?: string | null }) {
    const r = await updateFileInfo(f.id, info);
    if (!r.ok) return setErrors([r.error]);
    patchFile(f.id, info as Partial<ProductFile>);
    setNotice("Saved.");
  }

  /** Move PDFs to another product / subject (asks first). */
  async function moveTo(ids: string[], dest: string) {
    if (!ids.length || !dest) return;
    const where = destinations?.find((d) => d.value === dest)?.label ?? "the chosen product";
    const names = (files ?? []).filter((f) => ids.includes(f.id)).map((f) => `• ${f.display_name}`);
    if (!confirm(`Move ${ids.length} PDF${ids.length === 1 ? "" : "s"} to "${where}"?\n\n${names.slice(0, 10).join("\n")}${names.length > 10 ? `\n…and ${names.length - 10} more` : ""}\n\nStudents of "${where}" get ${ids.length === 1 ? "it" : "them"} at once; students of this product won't see ${ids.length === 1 ? "it" : "them"} here any more.`)) return;
    setBusyId("move");
    const r = await moveProductFiles(ids, dest);
    setBusyId("");
    if (!r.ok) return setErrors([r.error]);
    setErrors([]);
    const [toProduct, sub] = dest.split(":");
    if (toProduct === productId) setFiles((fs) => (fs ?? []).map((f) => (ids.includes(f.id) ? { ...f, subject: (sub || null) as ProductFile["subject"] } : f)));
    else setFiles((fs) => (fs ?? []).filter((f) => !ids.includes(f.id)));
    setSelected([]);
    setBulkTo("");
    setNotice(r.message ?? "Moved.");
  }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function choose(subject: string) {
    uploadSubject.current = subject;
    chooser.current?.click();
  }

  // Preview = exactly what a student gets: a watermarked copy (with the admin's own details). Never the original.
  function preview(f: ProductFile) {
    window.open(`/api/files/${f.id}/open`, "_blank", "noopener");
  }

  async function saveOrder(next: ProductFile[]) {
    setFiles(next);
    const r = await reorderProductFiles(productId, next.map((f) => f.id));
    setNotice(r.ok ? "Order saved." : "");
    if (!r.ok) setErrors([r.error]);
  }
  /** ↑ ↓ / drag inside ONE list (a subject, or all files): the other files keep their places */
  const move = (list: ProductFile[], from: number, to: number) => {
    if (!files || to < 0 || to >= list.length || from === to) return;
    const sub = [...list];
    const [item] = sub.splice(from, 1);
    sub.splice(to, 0, item);
    const ids = new Set(list.map((f) => f.id));
    const slots = files.map((f, i) => (ids.has(f.id) ? i : -1)).filter((i) => i >= 0);
    const next = [...files];
    slots.forEach((slot, k) => (next[slot] = sub[k]));
    void saveOrder(next);
  };

  function row(f: ProductFile, i: number, items: ProductFile[]) {
    return (
            <li
              key={f.id}
              draggable
              onDragStart={() => setDragId(f.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(items, items.findIndex((x) => x.id === dragId), i);
                setDragId(null);
              }}
              className={`flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 transition ${dragId === f.id ? "opacity-50 ring-brand-400" : "ring-slate-200"}`}
            >
              <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} aria-label={`Tick ${f.display_name}`} />
              <span className="cursor-grab select-none text-lg leading-none text-slate-300" title="Drag to reorder" aria-hidden>⋮⋮</span>
              <Badge kind={f.file_type} />
              <div className="min-w-0 flex-1">
                {f.file_type === "zip" && <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Hidden from students — upload a PDF instead</p>}
                {renaming?.id === f.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); void saveRename(); }} className="flex gap-2">
                    <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: f.id, name: e.target.value })} maxLength={120} className="input !py-1.5 text-sm" aria-label="File display name" />
                    <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">Save</button>
                    <button type="button" onClick={() => setRenaming(null)} className="btn-light !px-3 !py-1.5 text-xs">Cancel</button>
                  </form>
                ) : (
                  <p className="truncate font-semibold text-slate-900">{f.display_name}</p>
                )}
                {(bySubject || withChapter) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {bySubject && (
                      <select
                        value={f.subject ?? ""}
                        onChange={(e) => void saveInfo(f, { subject: e.target.value || null })}
                        className={`input !w-auto !py-1 text-xs ${f.subject ? "" : "!ring-amber-400"}`}
                        aria-label={`Subject of ${f.display_name}`}
                      >
                        <option value="">Subject…</option>
                        {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    )}
                    {withChapter && (
                      <input
                        key={`${f.id}-${f.chapter ?? ""}`}
                        defaultValue={f.chapter ?? ""}
                        maxLength={60}
                        placeholder="Chapter / Day (optional)"
                        onBlur={(e) => e.target.value.trim() !== (f.chapter ?? "") && void saveInfo(f, { chapter: e.target.value.trim() || null })}
                        className="input !w-48 !py-1 text-xs"
                        aria-label={`Chapter or day of ${f.display_name}`}
                      />
                    )}
                    
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {bySubject && f.subject ? `${subjectLabel(f.subject)} · ` : ""}{f.file_type.toUpperCase()} · {formatBytes(Number(f.size_bytes))} · added {formatDateTime(f.created_at)}{f.download_count ? <> · <DownloadIcon className="inline h-3 w-3" /> {f.download_count} old download{f.download_count === 1 ? "" : "s"}</> : null}
                </p>
                {f.file_type === "pdf" && siteConfig.inWebsiteReader && <PagesStatus f={f} progress={preparing[f.id]} />}
                {f.file_type === "pdf" && !siteConfig.inWebsiteReader && <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Students get Open PDF + Download (their own watermarked copy)</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => move(items, i, i - 1)} disabled={i === 0} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(items, i, i + 1)} disabled={i === items.length - 1} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                {f.file_type === "pdf" && <button type="button" onClick={() => preview(f)} className="btn-light !px-2.5 !py-1 text-xs">Preview</button>}
                {f.file_type === "pdf" && siteConfig.inWebsiteReader && (
                  <button type="button" disabled={!!preparing[f.id]} onClick={() => void preparePages(f.id)} className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-50" title="Turn the pages into pictures for the reader again">
                    {preparing[f.id] ? "Preparing…" : "Re-process"}
                  </button>
                )}
                <button type="button" onClick={() => setRenaming({ id: f.id, name: f.display_name })} className="btn-light !px-2.5 !py-1 text-xs"><EditIcon className="h-3.5 w-3.5" /> Rename</button>
                <button type="button" onClick={() => { replaceTarget.current = f.id; replacer.current?.click(); }} className="btn-light !px-2.5 !py-1 text-xs"><UploadIcon className="h-3.5 w-3.5" /> Replace</button>
                <button type="button" disabled={busyId === f.id} onClick={() => void remove(f)} className="btn-light !px-2.5 !py-1 text-xs !text-red-600 disabled:opacity-50"><TrashIcon className="h-3.5 w-3.5" /> Delete</button>
                <DestinationSelect value="" onChange={(v) => void moveTo([f.id], v)} destinations={destinations} label={`Move ${f.display_name} to`} compact />
              </div>
            </li>
    );
  }

  /** A drag-and-drop area (one per subject for crash courses) */
  const zone = (key: string, subject: string, compact: boolean) => (
    <DropZone
      compact={compact}
      label={subject ? SUBJECT_UI[subject as keyof typeof SUBJECT_UI].label : ""}
      active={dragOver === key}
      disabled={!!dragId}
      onOver={(on) => setDragOver(on ? key : null)}
      onFiles={(list) => addFiles(list, subject)}
      onChoose={() => choose(subject)}
    />
  );

  /** The list of files (with ↑ ↓ inside this list) */
  const list = (items: ProductFile[], label: string) =>
    items.length === 0 ? null : (
      <ul className="space-y-2" aria-label={label}>
        {items.map((f, i) => row(f, i, items))}
      </ul>
    );

  return (
    <div className="space-y-3">
      {files?.some((f) => f.file_type === "zip") && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          ⚠️ This item has ZIP file(s). Students don&apos;t get ZIP files — please upload the material as PDF instead (then delete the ZIP).
        </p>
      )}
      {/* Drop zone (crash courses: one per subject, further down) */}
      {!bySubject && zone("all", "", false)}
      <p className="text-xs text-slate-500">{siteConfig.inWebsiteReader ? "Students read PDFs online only (watermarked, no download)." : "Students get each PDF as their own copy, watermarked with their name, phone and email (Open PDF / Download)."} <strong>ZIP files are hidden from students — please upload PDFs instead.</strong></p>
      <input ref={chooser} type="file" multiple accept=".pdf,.zip,application/pdf,application/zip" className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files, uploadSubject.current); e.target.value = ""; }} />
      <input ref={replacer} type="file" accept=".pdf,.zip,application/pdf,application/zip" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replace(f); e.target.value = ""; }} />
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
        🔒 <strong>Use PDF for important material.</strong> Every PDF a student downloads is watermarked with their name, email and a Download ID.
        ZIP files can&apos;t be watermarked, so anyone could share them freely. Also avoid password-protected PDFs — they can&apos;t be watermarked and students would see &ldquo;Please try again&rdquo;.
      </p>

      {errors.length > 0 && (
        <div role="alert" className="space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
        </div>
      )}
      {warnings.length > 0 && (
        <div role="status" className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
        </div>
      )}
      {notice && <p className="text-xs font-semibold text-emerald-700">✓ {notice}</p>}

      {/* Uploads in progress */}
      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-slate-800">{u.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {u.status === "done" ? <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckIcon className="h-4 w-4" /> Uploaded</span> : u.status === "error" ? <span className="font-bold text-red-600">Failed</span> : `${u.progress}% of ${formatBytes(u.size)}`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${u.status === "error" ? "bg-red-500" : u.status === "done" ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${u.status === "error" ? 100 : u.progress}%` }} />
              </div>
              {u.error && <p className="mt-1 text-xs text-red-600">{u.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Ticked PDFs → move them together */}
      {files && files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-sm ring-1 ring-slate-200">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input type="checkbox" checked={selected.length === files.length} onChange={(e) => setSelected(e.target.checked ? files.map((f) => f.id) : [])} aria-label="Tick all PDFs" />
            {selected.length ? `${selected.length} ticked` : "Tick all"}
          </label>
          {selected.length > 0 && (
            <>
              <DestinationSelect value={bulkTo} onChange={setBulkTo} destinations={destinations} label="Move ticked PDFs to" />
              <button type="button" disabled={!bulkTo || busyId === "move"} onClick={() => void moveTo(selected, bulkTo)} className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50">
                {busyId === "move" ? "Moving…" : `Move ${selected.length}`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Uploaded files */}
      {files === null ? (
        <p className="text-sm text-slate-500">Loading files…</p>
      ) : bySubject ? (
        <div className="space-y-4">
          {SUBJECT_KEYS.map((key) => {
            const ui = SUBJECT_UI[key];
            const items = files.filter((f) => f.subject === key);
            return (
              <section key={key} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:p-4" aria-label={`${ui.label} PDFs`}>
                <h4 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-white ${ui.box}`}><ui.Icon className="h-4 w-4" /></span>
                  {ui.label}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">{items.length} PDF{items.length === 1 ? "" : "s"}</span>
                </h4>
                {zone(key, key, true)}
                <div className="mt-3">{list(items, `${ui.label} PDFs`) ?? <p className="text-center text-xs text-slate-500">No {ui.label} PDFs yet.</p>}</div>
              </section>
            );
          })}
          {files.some((f) => !SUBJECT_KEYS.includes(f.subject as never)) && (
            <section className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 sm:p-4" aria-label="PDFs without a subject">
              <h4 className="mb-1 font-extrabold text-amber-900">Not sorted yet ({files.filter((f) => !SUBJECT_KEYS.includes(f.subject as never)).length})</h4>
              <p className="mb-3 text-xs text-amber-900">Choose {subjectOptions.map((s) => s.label).join(", ").replace(/, ([^,]*)$/, " or $1")} for each — students see these under &ldquo;Other&rdquo; until then.</p>
              {list(files.filter((f) => !SUBJECT_KEYS.includes(f.subject as never)), "PDFs without a subject")}
            </section>
          )}
        </div>
      ) : files.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500 ring-1 ring-slate-200">No files yet.</p>
      ) : (
        list(files, "Files (drag to reorder)")
      )}
      {files && files.length > 1 && <p className="text-xs text-slate-500">Tip: use ↑ ↓ (or drag the ⋮⋮ handle) to change the order students see{bySubject ? " in each subject" : ""}.</p>}
    </div>
  );
}

function DropZone({ compact, label, active, disabled, onOver, onFiles, onChoose }: { compact: boolean; label: string; active: boolean; disabled: boolean; onOver: (on: boolean) => void; onFiles: (f: FileList) => void; onChoose: () => void }) {
  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        onOver(true);
      }}
      onDragLeave={() => onOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        onOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed text-center transition ${compact ? "p-3" : "p-5"} ${active ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"}`}
    >
      {!compact && <UploadIcon className="mx-auto h-7 w-7 text-brand-600" />}
      <p className={`text-sm font-semibold text-slate-700 ${compact ? "" : "mt-2"}`}>
        {compact ? <UploadIcon className="mr-1 inline h-4 w-4 text-brand-600" /> : null}
        Drag &amp; drop {label ? `${label} ` : ""}PDFs here, or{" "}
        <button type="button" onClick={onChoose} className="font-bold text-brand-700 underline">choose files</button>
      </p>
      <p className="mt-1 text-xs text-slate-500">PDF · max {siteConfig.uploads.maxFileMB} MB each · select many at once</p>
    </div>
  );
}

/** "Move to…" — every crash course × subject, Question Bank subject, study material and previous year paper. */
function DestinationSelect({ value, onChange, destinations, label, compact }: { value: string; onChange: (v: string) => void; destinations: FileDestination[] | null; label: string; compact?: boolean }) {
  const groups = [...new Set((destinations ?? []).map((d) => d.group))];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!destinations} className={`input !w-auto !py-1 text-xs ${compact ? "max-w-[9rem]" : "max-w-xs"}`} aria-label={label}>
      <option value="">{destinations ? "Move to…" : "Loading…"}</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {destinations!.filter((d) => d.group === g).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** "Ready for reading · 24 pages · 3.1 MB" / progress bar / error */
function PagesStatus({ f, progress }: { f: ProductFile; progress?: PagesProgress }) {
  if (progress) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="mt-1.5 max-w-sm">
        <p className="text-xs font-semibold text-brand-700">Preparing pages for reading… {progress.total ? `${progress.done} of ${progress.total}` : "starting"}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
    );
  }
  if (f.pages_status === undefined) return <p className="mt-1 text-xs text-amber-700">Run supabase/reader-pages.sql to turn on the fast reader.</p>;
  if (f.pages_status === "ready") {
    const avg = f.page_count ? Number(f.pages_bytes ?? 0) / f.page_count : 0;
    return <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Ready for reading · {f.page_count} pages · {formatBytes(Number(f.pages_bytes ?? 0))} ({formatBytes(avg)} per page)</p>;
  }
  if (f.pages_status === "failed") return <p className="mt-1 text-xs font-semibold text-red-700">⚠️ Pages could not be prepared: {f.pages_error || "unknown error"} — fix the PDF if needed and press Re-process.</p>;
  if (f.pages_status === "processing") return <p className="mt-1 text-xs font-semibold text-amber-700">Pages were being prepared but didn&apos;t finish — press Re-process.</p>;
  return <p className="mt-1 text-xs font-semibold text-amber-700">Not prepared yet (students get the slower reader) — press Re-process.</p>;
}
