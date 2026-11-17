// =====================================================================
//  SECURE READER (server only) — course material is READ ONLINE, never downloaded
//
//  • canRead(): logged in AND (paid for the product, or it's free, or admin).
//    Checked again for EVERY page the browser asks for.
//  • Short-lived tokens (5 minutes) bind a reading session to one student and
//    one file; the page route also checks the login cookie and the access.
//  • renderPage(): ONE page at a time, copied out of the original PDF into a
//    new single-page PDF with a repeating diagonal watermark burned in
//    (name · phone · email · date/time IST) + a footer. The original file and
//    its storage address are never sent to the browser.
//  • The browser draws that page on a canvas with pdf.js (no text layer → no
//    selecting/copying; no download/print/save buttons).
// =====================================================================
import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdfSafe } from "./watermark";

export const TOKEN_SECONDS = 5 * 60;

export type ReaderFile = { id: string; product_id: string; display_name: string; file_path: string; file_type: "pdf" | "zip" };
export type ReaderUser = { id: string; isAdmin: boolean };

/** May this student read this file? Returns the file, or why not. */
export async function canRead(db: SupabaseClient, user: ReaderUser, fileId: string): Promise<{ file: ReaderFile } | { error: "not-found" | "not-paid" | "zip" }> {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { error: "not-found" };
  const { data: f } = await db
    .from("product_files")
    .select("id,product_id,display_name,file_path,file_type,products(is_free,is_active)")
    .eq("id", fileId)
    .maybeSingle();
  if (!f) return { error: "not-found" };
  const product = f.products as unknown as { is_free: boolean; is_active: boolean } | null;
  const file = { id: f.id, product_id: f.product_id, display_name: f.display_name, file_path: f.file_path, file_type: f.file_type } as ReaderFile;
  if (file.file_type !== "pdf") return { error: "zip" }; // ZIPs can't be read in the browser
  if (user.isAdmin) return { file };
  // The same rule the database uses (supabase/courses-question-bank.sql): paid (also
  // after the product was hidden), free while visible, or Question Bank via the PCM
  // bundle / a crash course that includes it.
  const { data: allowed, error } = await db.rpc("can_access_product", { p_user: user.id, p_product: file.product_id });
  if (!error) return allowed === true ? { file } : { error: "not-paid" };
  // (SQL not run yet → the old rule, but buyers of hidden products keep access)
  const { count } = await db
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("product_id", file.product_id)
    .eq("status", "paid");
  if ((count ?? 0) > 0) return { file };
  return product?.is_active && product.is_free ? { file } : { error: "not-paid" };
}

// ---------------------------------------------------------------- tokens
let key: Buffer | null = null;
function tokenKey() {
  if (key) return key;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.READER_SECRET || "";
  if (secret.length < 20) throw new Error("Reader is not configured (SUPABASE_SERVICE_ROLE_KEY missing).");
  key = Buffer.from(hkdfSync("sha256", secret, "eduvora", "secure-reader-token-v1", 32));
  return key;
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** "<payload>.<signature>" — valid for TOKEN_SECONDS, for one student and one file. */
export function makeToken(userId: string, fileId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_SECONDS * 1000;
  const payload = b64(JSON.stringify({ u: userId, f: fileId, e: expiresAt }));
  const sig = b64(createHmac("sha256", tokenKey()).update(payload).digest());
  return { token: `${payload}.${sig}`, expiresAt };
}

export function checkToken(token: string | null, userId: string, fileId: string): boolean {
  if (!token || token.length > 600) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const want = createHmac("sha256", tokenKey()).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; f: string; e: number };
    return p.u === userId && p.f === fileId && typeof p.e === "number" && p.e > Date.now();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- the original PDF (kept in memory for a while)
type Loaded = { doc: PDFDocument; pages: number; bytes: number; at: number };
const cache = new Map<string, Loaded>();
const CACHE_BYTES = 150 * 1024 * 1024;
const CACHE_MS = 15 * 60 * 1000;

export async function loadOriginal(db: SupabaseClient, file: ReaderFile): Promise<Loaded> {
  const k = `${file.id}:${file.file_path}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    hit.at = Date.now();
    return hit;
  }
  const { data: blob, error } = await db.storage.from("materials").download(file.file_path);
  if (error || !blob) throw new Error(error?.message ?? "file not found");
  const raw = new Uint8Array(await blob.arrayBuffer());
  const doc = await PDFDocument.load(raw, { updateMetadata: false });
  const loaded = { doc, pages: doc.getPageCount(), bytes: raw.byteLength, at: Date.now() };
  if (loaded.pages === 0) throw new Error("This PDF has no pages.");
  cache.set(k, loaded);
  // keep memory in check: drop the least recently used files
  let total = [...cache.values()].reduce((s, v) => s + v.bytes, 0);
  for (const [ck, v] of [...cache.entries()].sort((a, b) => a[1].at - b[1].at)) {
    if (total <= CACHE_BYTES || ck === k) continue;
    cache.delete(ck);
    total -= v.bytes;
  }
  return loaded;
}

// ---------------------------------------------------------------- one watermarked page
export type Mark = { name: string; phone: string; email: string; when: Date; viewId: string };

const istStamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d) + " IST";

/** Page `n` (1-based) as its own small PDF, with the student's watermark burned in. */
export async function renderPage(src: PDFDocument, n: number, mark: Mark): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(src, [n - 1]);
  out.addPage(page);
  out.setTitle("EDUVORA — personal copy");
  out.setProducer("EDUVORA secure reader");
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  const name = pdfSafe(mark.name).slice(0, 60) || "Student";
  const phone = pdfSafe(mark.phone).slice(0, 20);
  const email = pdfSafe(mark.email).slice(0, 80);
  const line = [name, phone, email, istStamp(mark.when)].filter(Boolean).join("  ·  ");

  const { width: w, height: h } = page.getSize();
  // Repeating diagonal grid of the watermark over the WHOLE page (light, can't be removed in the browser)
  const size = Math.max(7, Math.min(11, w / 55));
  const tw = font.widthOfTextAtSize(line, size);
  const angle = 30;
  const stepX = tw + size * 6;
  const stepY = size * 9;
  const reach = Math.hypot(w, h);
  for (let y = -reach; y < reach * 1.2; y += stepY) {
    const shift = (Math.round(y / stepY) % 2) * (stepX / 2); // brick pattern
    for (let x = -reach + shift; x < reach; x += stepX) {
      page.drawText(line, { x, y, size, font, color: rgb(0.35, 0.38, 0.45), opacity: 0.16, rotate: degrees(angle) });
    }
  }
  // Footer: who, when, view id
  const footer = `Licensed to ${name}${phone ? ` (${phone})` : ""} · ${istStamp(mark.when)} · ID ${mark.viewId.slice(0, 8).toUpperCase()} · Personal use only — sharing or screenshots are traceable`;
  const fsz = Math.max(5.5, Math.min(7.5, w / 85));
  page.drawRectangle({ x: 0, y: 0, width: w, height: fsz * 2.6, color: rgb(1, 1, 1), opacity: 0.85 });
  page.drawText(footer, { x: 8, y: fsz * 0.9, size: fsz, font: bold, color: rgb(0.3, 0.32, 0.38), maxWidth: w - 16 });
  return out.save({ useObjectStreams: true });
}

// ---------------------------------------------------------------- fast mode: pre-made WebP pages
export type PageInfo = { ready: boolean; pages: number; version: number };

/** Are this file's WebP pages ready? (null = supabase/reader-pages.sql not run yet) */
export async function pageInfo(db: SupabaseClient, fileId: string): Promise<PageInfo | null> {
  const { data, error } = await db.from("product_files").select("page_count,pages_status,pages_version").eq("id", fileId).maybeSingle();
  if (error || !data) return null;
  return { ready: data.pages_status === "ready" && Number(data.page_count) > 0, pages: Number(data.page_count ?? 0), version: Number(data.pages_version ?? 0) };
}
