// =====================================================================
//  WATERMARKED PDF DELIVERY (server only)
//  "Open PDF" (new tab, the browser's own viewer) and "Download" for a
//  student who has access. Every request:
//   1. login + access (paid / free / admin) checked against the database
//   2. daily limit per student per file (Admin → Settings, default 20)
//   3. their personal watermarked copy: from the 7-day cache in the private
//      'watermarked' bucket, or made now with pdf-lib (src/lib/watermark.ts)
//   4. logged (Admin → Products → Downloads) with the ID printed on the copy
//   5. a 5-minute signed link to THAT copy (inline to open, attachment to
//      download) — copying the link only works for 5 minutes
//  The original file and its storage address are never sent. If the
//  watermark can't be made → "Please try again" (never the original).
// =====================================================================
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import type { Session } from "./dashboard";
import { unlockFreeProduct } from "./free-resources";
import { canRead, type ReaderFile } from "./reader";
import { cleanupWatermarked, deviceId, shortCopyId, watermarkPdf } from "./watermark";

export const LINK_SECONDS = 5 * 60;
const CACHE_DAYS = 7;
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

/** The whole "Open PDF" / "Download" request for a student. */
export async function deliverPdf(request: NextRequest, db: SupabaseClient, s: Session, fileId: string, mode: PdfMode): Promise<NextResponse> {
  const isAdmin = s.profile?.role === "admin";
  const access = await canRead(db, { id: s.user.id, isAdmin }, fileId);
  if ("error" in access) {
    if (access.error === "zip") return page("Not available", "This file isn't available to students. Please contact us.", 404);
    if (access.error === "not-found") return page("File not found", "It may have been removed or replaced. Please check My Courses &amp; Material.", 404);
    return page("This file is locked", "You need to buy this item first. If you already paid, please contact us with your Payment ID.", 403);
  }
  const file = access.file;
  // Free item opened from a link → also add it to My Courses
  const { data: product } = await db.from("products").select("is_free").eq("id", file.product_id).maybeSingle();
  if (product?.is_free && !isAdmin) await unlockFreeProduct(db, s.user.id, file.product_id);

  // ---- daily limit (students) ----
  if (!isAdmin) {
    const [limit, used] = await Promise.all([
      dailyLimit(db),
      db.from("file_downloads").select("id", { count: "exact", head: true }).eq("user_id", s.user.id).eq("file_id", file.id).eq("status", "ok").gte("created_at", startOfTodayIST()),
    ]);
    if ((used.count ?? 0) >= limit) {
      return page("Daily limit reached", `You've opened or downloaded this file ${limit} times today — that's the daily limit. Please use the copy you already downloaded, or try again tomorrow. Need help? Contact us.`, 429);
    }
  }

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

  // ---- the student's copy: cached (7 days) or made now ----
  let storagePath = "";
  let copyId = "";
  try {
    const { data: cached } = await db.from("pdf_copies").select("file_path,copy_id,storage_path,created_at").eq("user_id", s.user.id).eq("file_id", file.id).maybeSingle();
    const fresh = cached && cached.file_path === file.file_path && Date.now() - new Date(cached.created_at as string).getTime() < CACHE_DAYS * 86_400_000;
    if (fresh) {
      storagePath = cached.storage_path as string;
      copyId = cached.copy_id as string;
    } else {
      copyId = crypto.randomUUID();
      const marked = await watermarkPdf(await originalBytes(db, file), {
        name: s.profile?.full_name || s.user.email?.split("@")[0] || "Student",
        phone: s.profile?.phone ? `+${String(s.profile.phone).replace(/^\+/, "")}` : s.user.phone ? `+${s.user.phone}` : "",
        email: s.profile?.email || s.user.email || "",
        copyId,
        when: new Date(),
        title: file.display_name,
      });
      storagePath = `copies/${s.user.id}/${file.id}.pdf`;
      const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, marked, { contentType: "application/pdf", upsert: true, cacheControl: "0" });
      if (upErr) throw new Error(upErr.message);
      await db.from("pdf_copies").upsert({ user_id: s.user.id, file_id: file.id, file_path: file.file_path, copy_id: copyId, storage_path: storagePath, created_at: new Date().toISOString() });
    }
  } catch (e) {
    console.warn("[pdf] watermark failed:", (e as Error).message);
    await log({ copyId: null, watermarked: false, status: "failed", error: (e as Error).message.slice(0, 300) });
    return page("Please try again", "We couldn't prepare your personal copy of this file just now. Please try again in a moment. If it keeps happening, contact us.", 503, `/api/files/${fileId}?mode=${mode}`);
  }

  // ---- a 5-minute link to THAT copy ----
  const { data: signed, error: sErr } = await db.storage.from(BUCKET).createSignedUrl(storagePath, LINK_SECONDS, mode === "download" ? { download: fileName } : undefined);
  if (sErr || !signed) {
    await log({ copyId, watermarked: true, status: "failed", error: sErr?.message ?? "no link" });
    return page("Please try again", "We couldn't open your copy just now. Please try again in a moment.", 503, `/api/files/${fileId}?mode=${mode}`);
  }
  if (!isAdmin) await log({ copyId, watermarked: true, status: "ok" });
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

/** Remove watermarked copies older than 7 days (+ the old temporary folders). */
export async function cleanupCopies(db: SupabaseClient) {
  await cleanupWatermarked(db).catch(() => 0);
  const before = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
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
