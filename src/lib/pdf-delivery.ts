// =====================================================================
//  WATERMARKED PDF DELIVERY (server only)
//  "Open PDF" (new tab, the browser's own viewer) and "Download" for a
//  student who has access. Every request:
//   1. login + access (paid / free / admin) checked against the database
//   2. daily limit per student per file (Admin → Settings, default 20)
//   3. their personal watermarked copy: from the 24-hour cache in the private
//      'watermarked' bucket, or made now with pdf-lib (src/lib/watermark.ts).
//      A new copy is sent at once; saving it to the cache happens alongside.
//   4. logged (Admin → Products → Downloads) with the ID printed on the copy
//   5. the copy's BYTES are streamed from this server (inline to open,
//      attachment to download), "private, no-store". No storage link (signed
//      or public) ever reaches the browser, so a copied link is just
//      /api/files/<id>/open — which checks login + access again, and only ever
//      sends the logged-in account its OWN copy.
//  The original file and any storage address are never sent. If the
//  watermark can't be made → "Please try again" (never the original).
// =====================================================================
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after, NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { reportFailure } from "./monitor";
import type { Session } from "./dashboard";
import { unlockFreeProduct } from "./free-resources";
import { recordOpened } from "./progress";
import { canRead, type ReaderFile } from "./reader";
import { cleanupWatermarked, deviceId, shortCopyId, watermarkPdf, WM_VERSION } from "./watermark";

const CACHE_MS = 24 * 60 * 60 * 1000; // a student's copy is kept at most 24 hours (then made again on the next open)
const BUCKET = "watermarked";
const DEFAULT_DAILY_LIMIT = 20;

export type PdfMode = "open" | "download";

/** "EDUVORA - Chemistry Formula Book.pdf" */
export const cleanFileName = (displayName: string) =>
  `${siteConfig.businessName} - ${displayName.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Study material"}.pdf`;

// ---------- friendly pages ----------
function page(title: string, text: string, status: number, retry?: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f5f9;font-family:system-ui,sans-serif;color:#0b2a5b}main{max-width:26rem;margin:1rem;background:#fff;border-radius:1.5rem;padding:2rem;text-align:center;box-shadow:0 10px 30px #0b2a5b1a}h1{font-size:1.35rem;margin:.5rem 0}p{color:#475569;line-height:1.6}a{display:inline-block;margin:.4rem;padding:.75rem 1.2rem;border-radius:.8rem;font-weight:700;text-decoration:none}.p{background:#0b2a5b;color:#fff}.l{background:#e2e8f0;color:#0b2a5b}</style></head>
<body><main><h1>${title}</h1><p>${text}</p>${retry ? `<a class="p" href="${retry}">Try again</a>` : ""}<a class="l" href="/dashboard/courses">Back to My Courses</a></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

// ---------- the original PDF, kept in memory briefly (many students → one download) ----------
const originals = new Map<string, { bytes: Uint8Array; at: number }>();
async function originalBytes(db: SupabaseClient, file: ReaderFile): Promise<Uint8Array> {
  const key = `${file.id}:${file.file_path}`;
  const hit = originals.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.bytes;
  const { data: blob, error } = await db.storage.from("materials").download(file.file_path);
  if (error || !blob) throw new Error(error?.message ?? "original not found");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  originals.set(key, { bytes, at: Date.now() });
  let total = [...originals.values()].reduce((n, v) => n + v.bytes.byteLength, 0);
  for (const [k, v] of [...originals.entries()].sort((a, b) => a[1].at - b[1].at)) {
    if (total < 120 * 1024 * 1024 || k === key) continue;
    originals.delete(k);
    total -= v.bytes.byteLength;
  }
  return bytes;
}

async function dailyLimit(db: SupabaseClient) {
  const { data } = await db.from("pdf_settings").select("daily_limit").eq("id", 1).maybeSingle();
  return Number(data?.daily_limit) || DEFAULT_DAILY_LIMIT;
}
const startOfTodayIST = () => {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(`${d}T00:00:00+05:30`).toISOString();
};

// ---------- the steps, named (shown in Sentry as tag "step" when one fails) ----------
export type PdfStep = "cache-lookup" | "download-original" | "watermark" | "cache-save" | "cache-read";
class StepError extends Error {
  constructor(readonly step: PdfStep, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PdfStepError";
  }
}
async function step<T>(name: PdfStep, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw e instanceof StepError ? e : new StepError(name, e);
  }
}

type Fail = { title: string; text: string; status: number };
type Checked = { file: ReaderFile; isAdmin: boolean };

/** Login is already checked. Access (paid / free / admin) + the daily limit. */
async function checkAccess(db: SupabaseClient, s: Session, fileId: string): Promise<Checked | { fail: Fail }> {
  const isAdmin = s.profile?.role === "admin";
  const access = await canRead(db, { id: s.user.id, isAdmin }, fileId);
  if ("error" in access) {
    if (access.error === "zip") return { fail: { title: "Not available", text: "This file isn't available to students. Please contact us.", status: 404 } };
    if (access.error === "not-found") return { fail: { title: "File not found", text: "It may have been removed or replaced. Please check My Courses &amp; Material.", status: 404 } };
    return { fail: { title: "You don't have access to this file", text: "This file belongs to a course or item your account hasn't bought. If you paid for it, log in with that account — or contact us with your Payment ID.", status: 403 } };
  }
  const file = access.file;
  // Free item opened from a link → also add it to My Courses
  const { data: product } = await db.from("products").select("is_free").eq("id", file.product_id).maybeSingle();
  if (product?.is_free && !isAdmin) await unlockFreeProduct(db, s.user.id, file.product_id);

  if (!isAdmin) {
    const [limit, used] = await Promise.all([
      dailyLimit(db),
      db.from("file_downloads").select("id", { count: "exact", head: true }).eq("user_id", s.user.id).eq("file_id", file.id).eq("status", "ok").gte("created_at", startOfTodayIST()),
    ]);
    if ((used.count ?? 0) >= limit) {
      return { fail: { title: "Daily limit reached", text: `You've opened or downloaded this file ${limit} times today — that's the daily limit. Please use the copy you already downloaded, or try again tomorrow. Need help? Contact us.`, status: 429 } };
    }
  }
  return { file, isAdmin };
}

const copyPath = (s: Session, file: ReaderFile) => `copies/${createHash("sha256").update(`${s.user.id}:${file.id}`).digest("hex").slice(0, 40)}.pdf`; // (no user id in it)

type Copy = {
  copyId: string;
  storagePath: string;
  /** made just now (null = a cached copy in storage) */
  bytes: Uint8Array | null;
  /** saving the new copy to the 24-hour cache (true = saved). Never throws. */
  saved: Promise<boolean>;
  /** for Sentry: size of the original and how long each step took */
  facts: Record<string, number | string | boolean>;
};

/** Makes the student's watermarked copy now. The cache is saved in the background — the student never waits for it. */
async function makeCopy(db: SupabaseClient, s: Session, file: ReaderFile, copyId: string, facts: Copy["facts"]): Promise<Copy> {
  let t = Date.now();
  const original = await step("download-original", () => originalBytes(db, file));
  facts.originalMB = Math.round((original.byteLength / 1048576) * 10) / 10;
  facts.downloadMs = Date.now() - t;
  t = Date.now();
  const bytes = await step("watermark", () =>
    watermarkPdf(original, {
      name: s.profile?.full_name || s.user.email?.split("@")[0] || "Student",
      phone: s.profile?.phone ? `+${String(s.profile.phone).replace(/^\+/, "")}` : s.user.phone ? `+${s.user.phone}` : "",
      email: s.profile?.email || s.user.email || "",
      copyId,
      when: new Date(),
      title: file.display_name,
    }),
  );
  facts.watermarkMs = Date.now() - t;
  const storagePath = copyPath(s, file);
  // The cache only saves time on the next open. If it can't be saved (e.g. the copy is bigger
  // than the storage file-size limit) the student still gets this copy.
  const saved = (async () => {
    const t0 = Date.now();
    try {
      const { error } = await db.storage.from(BUCKET).upload(storagePath, bytes, { contentType: "application/pdf", upsert: true, cacheControl: "0" });
      if (error) throw new Error(error.message);
      await db.from("pdf_copies").upsert({ user_id: s.user.id, file_id: file.id, file_path: file.file_path, copy_id: copyId, storage_path: storagePath, created_at: new Date().toISOString(), wm_version: WM_VERSION });
      return true;
    } catch (e) {
      reportFailure("pdf", "Saving the watermarked copy to the cache failed", new StepError("cache-save", e), { step: "cache-save", fileId: file.id, file: file.display_name, sizeMB: Math.round((bytes.byteLength / 1048576) * 10) / 10, ms: Date.now() - t0 }, "warning");
      return false;
    }
  })();
  return { copyId, storagePath, bytes, saved, facts };
}

/** The student's copy: from the 24-hour cache, or made now. Throws a StepError. */
async function getCopy(db: SupabaseClient, s: Session, file: ReaderFile, facts: Copy["facts"]): Promise<Copy> {
  // (if supabase/courses-question-bank.sql hasn't been run yet there is no wm_version → no cache, every copy made fresh)
  const { data: cached } = await step("cache-lookup", async () => db.from("pdf_copies").select("file_path,copy_id,storage_path,created_at,wm_version").eq("user_id", s.user.id).eq("file_id", file.id).maybeSingle());
  const fresh = cached && cached.file_path === file.file_path && Number(cached.wm_version) >= WM_VERSION && Date.now() - new Date(cached.created_at as string).getTime() < CACHE_MS;
  if (fresh) return { copyId: cached.copy_id as string, storagePath: cached.storage_path as string, bytes: null, saved: Promise.resolve(true), facts: { cached: true } };
  return makeCopy(db, s, file, crypto.randomUUID(), facts);
}

/** Sentry: which file, which step, how big and how long — never the student's name, email or phone. */
function reportPdfFailure(e: unknown, file: ReaderFile, mode: PdfMode | "prepare", started: number, facts?: Copy["facts"]) {
  const stepName = e instanceof StepError ? e.step : "unknown";
  reportFailure("pdf", `PDF ${mode} failed at step: ${stepName}`, e, {
    step: stepName,
    mode,
    fileId: file.id,
    productId: file.product_id,
    file: file.display_name.slice(0, 80),
    totalMs: Date.now() - started,
    ...facts,
  });
}

/** "Download" button (in the page, before the download starts): makes sure the copy is ready
 *  and saved, so the download itself starts at once. JSON answer: { ok } or { message }. */
export async function preparePdf(db: SupabaseClient, s: Session, fileId: string, mode: PdfMode): Promise<NextResponse> {
  const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  const checked = await checkAccess(db, s, fileId);
  if ("fail" in checked) return json({ ok: false, message: checked.fail.text.replace(/&amp;/g, "&"), title: checked.fail.title, retry: false }, checked.fail.status);
  const started = Date.now();
  const facts: Copy["facts"] = {};
  try {
    const copy = await getCopy(db, s, checked.file, facts);
    await copy.saved;
    return json({ ok: true, href: `/api/files/${fileId}/${mode}`, cached: copy.bytes === null });
  } catch (e) {
    reportPdfFailure(e, checked.file, "prepare", started, facts);
    return json({ ok: false, message: "We couldn't prepare your personal copy of this file just now. Please try again in a moment. If it keeps happening, contact us.", retry: true }, 503);
  }
}

/** The whole "Open PDF" / "Download" request for a student. */
export async function deliverPdf(request: NextRequest, db: SupabaseClient, s: Session, fileId: string, mode: PdfMode): Promise<NextResponse> {
  const checked = await checkAccess(db, s, fileId);
  if ("fail" in checked) return page(checked.fail.title, checked.fail.text, checked.fail.status);
  const file = checked.file;
  const started = Date.now();

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const device = (request.cookies.get("eduvora_rd")?.value || deviceId(ip, ua)).slice(0, 64);
  const fileName = cleanFileName(file.display_name);
  const log = (fields: { copyId: string | null; watermarked: boolean; status: "ok" | "failed"; error?: string }) =>
    db
      .from("file_downloads")
      .insert({
        id: crypto.randomUUID(),
        copy_id: fields.copyId,
        user_id: s.user.id,
        file_id: file.id,
        product_id: file.product_id,
        file_name: fileName,
        file_type: "pdf",
        action: mode === "open" ? "view" : "download",
        device,
        user_agent: ua || null,
        watermarked: fields.watermarked,
        status: fields.status,
        error: fields.error ?? null,
      })
      .then(({ error }) => error && console.warn("[pdf] log failed (run supabase/pdf-downloads.sql?):", error.message));

  // ---- the student's copy: cached (24 hours) or made now ----
  let copy: Copy;
  const facts: Copy["facts"] = {};
  try {
    copy = await getCopy(db, s, file, facts);
  } catch (e) {
    reportPdfFailure(e, file, mode, started, facts);
    await log({ copyId: null, watermarked: false, status: "failed", error: `${e instanceof StepError ? e.step : "unknown"}: ${(e as Error).message}`.slice(0, 300) });
    return page("Please try again", "We couldn't prepare your personal copy of this file just now. Please try again in a moment. If it keeps happening, contact us.", 503, `/api/files/${fileId}/${mode}`);
  }

  // ---- the copy's bytes, streamed from this server (never a storage link) ----
  let body: ReadableStream<Uint8Array>;
  let length = 0;
  try {
    if (copy.bytes) body = bytesStream(copy.bytes);
    else {
      try {
        ({ body, length } = await step("cache-read", () => storedCopyStream(db, copy.storagePath)));
      } catch {
        // the cached copy was cleaned up in the meantime → make it again now (same copy ID)
        copy = await makeCopy(db, s, file, copy.copyId, { cacheMissing: true });
        body = bytesStream(copy.bytes!);
      }
    }
  } catch (e) {
    reportPdfFailure(e, file, mode, started, copy.facts);
    await log({ copyId: copy.copyId, watermarked: true, status: "failed", error: `${e instanceof StepError ? e.step : "unknown"}: ${(e as Error).message}`.slice(0, 300) });
    return page("Please try again", "We couldn't open your copy just now. Please try again in a moment.", 503, `/api/files/${fileId}/${mode}`);
  }
  const saving = copy.saved;
  after(() => saving); // the cache is saved while the student is already receiving the file
  await log({ copyId: copy.copyId, watermarked: true, status: "ok" }); // every open / download, with the account (admins too)
  await recordOpened(db, s.user.id, file.id); // "Continue where you left off" (supabase/course-progress.sql)
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      ...((copy.bytes?.byteLength ?? length) > 0 ? { "Content-Length": String(copy.bytes?.byteLength ?? length) } : {}), // the phone shows real download progress
      "Content-Disposition": `${mode === "download" ? "attachment" : "inline"}; filename="${fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/** In-memory bytes → a stream (streamed responses aren't limited to 4.5 MB on Vercel) */
function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const CHUNK = 256 * 1024;
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.byteLength) return controller.close();
      controller.enqueue(bytes.subarray(at, at + CHUNK));
      at += CHUNK;
    },
  });
}

/** A cached copy, piped from the private bucket by the server (a 60-second link used ONLY here, never sent on). */
async function storedCopyStream(db: SupabaseClient, path: string): Promise<{ body: ReadableStream<Uint8Array>; length: number }> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new Error(error?.message ?? "copy not found");
  const res = await fetch(data.signedUrl, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`storage ${res.status}`);
  return { body: res.body, length: Number(res.headers.get("content-length")) || 0 };
}

/** Remove watermarked copies older than 24 hours (+ the old temporary folders). */
export async function cleanupCopies(db: SupabaseClient) {
  await cleanupWatermarked(db).catch(() => 0);
  const before = new Date(Date.now() - CACHE_MS).toISOString();
  const { data: old } = await db.from("pdf_copies").select("user_id,file_id,storage_path").lt("created_at", before).limit(300);
  if (!old?.length) return 0;
  await db.storage.from(BUCKET).remove(old.map((o) => o.storage_path as string));
  for (const o of old) await db.from("pdf_copies").delete().eq("user_id", o.user_id).eq("file_id", o.file_id).lt("created_at", before);
  return old.length;
}

/** The admin replaced a file → its students' copies are no longer valid: remove them. */
export async function clearCopiesOfFile(db: SupabaseClient, fileId: string) {
  const { data } = await db.from("pdf_copies").select("storage_path").eq("file_id", fileId).limit(5000);
  if (data?.length) await db.storage.from(BUCKET).remove(data.map((d) => d.storage_path as string));
  await db.from("pdf_copies").delete().eq("file_id", fileId);
}

export { shortCopyId };
