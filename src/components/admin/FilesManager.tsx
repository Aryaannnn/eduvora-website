"use client";

// =====================================================================
//  ADMIN → PRODUCT FILES (PDF / ZIP)
//  Drag & drop or "Choose files" · progress bar per file · rename ·
//  replace · delete · preview (PDF) · drag rows to change the order.
//  Files go straight from your browser to the PRIVATE Supabase bucket
//  using a one-time upload link from the server (admin checked there).
// =====================================================================
import { useEffect, useRef, useState } from "react";
import {
  deleteProductFile,
  finishFileUpload,
  listProductFiles,
  previewProductFile,
  renameProductFile,
  reorderProductFiles,
  startFileUpload,
} from "@/app/admin/file-actions";
import { siteConfig } from "@/config/site";
import { processPdfPages, type PagesProgress } from "@/lib/process-pages-client";
import { formatDateTime } from "@/lib/format";
import { checkFile, formatBytes, type ProductFile } from "@/lib/product-files";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { CheckIcon, DownloadIcon, EditIcon, TrashIcon, UploadIcon } from "../Icons";

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

export default function FilesManager({ productId }: { productId: string }) {
  const [files, setFiles] = useState<ProductFile[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
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

  async function uploadOne(file: File, replaceId?: string) {
    const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
    setUploads((u) => [...u, { key, name: file.name, size: file.size, progress: 0, status: "uploading" }]);
    try {
      const start = await startFileUpload(productId, file.name, file.size, file.type);
      if (!start.ok) throw new Error(start.error);
      await putWithProgress(start.data!.path, start.data!.token, file, start.data!.contentType, (p) => patchUpload(key, { progress: p }));
      const done = await finishFileUpload({ productId, path: start.data!.path, fileName: file.name, size: file.size, replaceId });
      if (!done.ok) throw new Error(done.error);
      const saved = done.data!.file;
      setFiles((fs) => (replaceId ? (fs ?? []).map((f) => (f.id === replaceId ? saved : f)) : [...(fs ?? []), saved]));
      patchUpload(key, { progress: 100, status: "done" });
      setTimeout(() => setUploads((u) => u.filter((x) => x.key !== key)), 4000);
      if (saved.file_type === "pdf" && siteConfig.inWebsiteReader) void preparePages(saved.id); // pages → WebP for the in-website reader (once)
    } catch (e) {
      patchUpload(key, { status: "error", error: (e as Error).message });
    }
  }

  function addFiles(list: FileList | File[]) {
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const p = checkFile(f.name, f.size, f.type); // checked BEFORE uploading
      if (p) problems.push(p);
      else ok.push(f);
    }
    setErrors(problems);
    setNotice("");
    ok.forEach((f) => void uploadOne(f));
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

  async function preview(f: ProductFile) {
    const win = window.open("", "_blank"); // open now (pop-up blockers), fill in when the link is ready
    const r = await previewProductFile(f.id);
    if (r.ok && r.data && win) win.location.href = r.data.url;
    else {
      win?.close();
      setErrors([r.ok ? "Could not open the file." : r.error]);
    }
  }

  async function saveOrder(next: ProductFile[]) {
    setFiles(next);
    const r = await reorderProductFiles(productId, next.map((f) => f.id));
    setNotice(r.ok ? "Order saved." : "");
    if (!r.ok) setErrors([r.error]);
  }
  const move = (from: number, to: number) => {
    if (!files || to < 0 || to >= files.length || from === to) return;
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void saveOrder(next);
  };

  return (
    <div className="space-y-3">
      {files?.some((f) => f.file_type === "zip") && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          ⚠️ This item has ZIP file(s). Students don&apos;t get ZIP files — please upload the material as PDF instead (then delete the ZIP).
        </p>
      )}
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          if (dragId) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (dragId) return;
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"}`}
      >
        <UploadIcon className="mx-auto h-7 w-7 text-brand-600" />
        <p className="mt-2 text-sm font-semibold text-slate-700">Drag &amp; drop PDF files here</p>
        <p className="text-xs text-slate-500">or</p>
        <button type="button" onClick={() => chooser.current?.click()} className="btn-primary mt-2 !px-4 !py-2 text-sm">Choose files</button>
        <p className="mt-3 text-xs text-slate-500">
          PDF (.pdf) · <strong>max {siteConfig.uploads.maxFileMB} MB per file</strong> · you can select several at once · private, buyers only
        </p>
        <p className="mt-2 text-xs text-slate-500">{siteConfig.inWebsiteReader ? "Students read PDFs online only (watermarked, no download)." : "Students get each PDF as their own copy, watermarked with their name, phone and email (Open PDF / Download)."} <strong>ZIP files are hidden from students — please upload PDFs instead.</strong></p>
        <input ref={chooser} type="file" multiple accept=".pdf,.zip,application/pdf,application/zip" className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={replacer} type="file" accept=".pdf,.zip,application/pdf,application/zip" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void replace(f); e.target.value = ""; }} />
      </div>
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
        🔒 <strong>Use PDF for important material.</strong> Every PDF a student downloads is watermarked with their name, email and a Download ID.
        ZIP files can&apos;t be watermarked, so anyone could share them freely. Also avoid password-protected PDFs — they can&apos;t be watermarked and students would see &ldquo;Please try again&rdquo;.
      </p>

      {errors.length > 0 && (
        <div role="alert" className="space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
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

      {/* Uploaded files */}
      {files === null ? (
        <p className="text-sm text-slate-500">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-500 ring-1 ring-slate-200">No files yet.</p>
      ) : (
        <ul className="space-y-2" aria-label="Files (drag to reorder)">
          {files.map((f, i) => (
            <li
              key={f.id}
              draggable
              onDragStart={() => setDragId(f.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(files.findIndex((x) => x.id === dragId), i);
                setDragId(null);
              }}
              className={`flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 transition ${dragId === f.id ? "opacity-50 ring-brand-400" : "ring-slate-200"}`}
            >
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
                <p className="text-xs text-slate-500">
                  {f.file_type.toUpperCase()} · {formatBytes(Number(f.size_bytes))} · added {formatDateTime(f.created_at)}{f.download_count ? <> · <DownloadIcon className="inline h-3 w-3" /> {f.download_count} old download{f.download_count === 1 ? "" : "s"}</> : null}
                </p>
                {f.file_type === "pdf" && siteConfig.inWebsiteReader && <PagesStatus f={f} progress={preparing[f.id]} />}
                {f.file_type === "pdf" && !siteConfig.inWebsiteReader && <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Students get Open PDF + Download (their own watermarked copy)</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === files.length - 1} className="btn-light !px-2 !py-1 text-xs disabled:opacity-30" aria-label="Move down">↓</button>
                {f.file_type === "pdf" && <button type="button" onClick={() => void preview(f)} className="btn-light !px-2.5 !py-1 text-xs">Preview</button>}
                {f.file_type === "pdf" && siteConfig.inWebsiteReader && (
                  <button type="button" disabled={!!preparing[f.id]} onClick={() => void preparePages(f.id)} className="btn-light !px-2.5 !py-1 text-xs disabled:opacity-50" title="Turn the pages into pictures for the reader again">
                    {preparing[f.id] ? "Preparing…" : "Re-process"}
                  </button>
                )}
                <button type="button" onClick={() => setRenaming({ id: f.id, name: f.display_name })} className="btn-light !px-2.5 !py-1 text-xs"><EditIcon className="h-3.5 w-3.5" /> Rename</button>
                <button type="button" onClick={() => { replaceTarget.current = f.id; replacer.current?.click(); }} className="btn-light !px-2.5 !py-1 text-xs"><UploadIcon className="h-3.5 w-3.5" /> Replace</button>
                <button type="button" disabled={busyId === f.id} onClick={() => void remove(f)} className="btn-light !px-2.5 !py-1 text-xs !text-red-600 disabled:opacity-50"><TrashIcon className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {files && files.length > 1 && <p className="text-xs text-slate-500">Tip: drag the ⋮⋮ handle (or use ↑ ↓) to change the order students see.</p>}
    </div>
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
