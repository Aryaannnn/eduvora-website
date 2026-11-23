// POST /api/admin/files/<file id>/process   { from: 1 }
// Admin only. Turns the PDF's pages into WebP pictures for the fast reader,
// a few pages per call (the admin page calls again with `from` = nextFrom
// until finished, showing progress). from = 1 starts again from scratch
// (new version folder); the old pictures are removed when the new set is done.
import { siteConfig } from "@/config/site";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { openPdf, PAGES_BUCKET, pagePath, removePages, type OpenPdf } from "@/lib/pdf-pages";
import { reportFailure } from "@/lib/monitor";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;
const TIME_BUDGET_MS = 35_000; // stop the batch early and let the browser call again

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// The PDF stays open between calls on the same server (no re-download for every batch)
const open = new Map<string, { pdf: OpenPdf; at: number }>();
async function getPdf(key: string, fetchBytes: () => Promise<Uint8Array>) {
  const hit = open.get(key);
  if (hit) {
    hit.at = Date.now();
    return hit.pdf;
  }
  const pdf = await openPdf(await fetchBytes());
  open.set(key, { pdf, at: Date.now() });
  for (const [k, v] of open) {
    if (k === key || Date.now() - v.at <= 5 * 60_000) continue;
    open.delete(k); // not used for 5 minutes → free the memory
    void v.pdf.close().catch(() => {});
  }
  return pdf;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/files/[id]/process">) {
  // The in-website reader is switched off → no page pictures are made (they would only use storage)
  if (!siteConfig.inWebsiteReader) return NextResponse.json({ error: "The in-website reader is switched off, so pages are not prepared." }, { status: 409 });
  const started = Date.now();
  const { id } = await ctx.params;
  const s = await getSession();
  if (!s || s.profile?.role !== "admin" || !(await hasAdmin2fa(s))) return json({ error: "Only admins can do this (sign in with your authenticator app)." }, 403);
  const db = getAdminSupabase();
  if (!db) return json({ error: "Storage is not set up." }, 503);
  const body = (await request.json().catch(() => ({}))) as { from?: number };
  const from = Math.max(1, Math.floor(Number(body.from) || 1));

  const { data: f, error: fErr } = await db
    .from("product_files")
    .select("id,display_name,file_path,file_type,pages_version,pages_bytes,page_count")
    .eq("id", id)
    .maybeSingle();
  if (fErr) return json({ error: /pages_version|column/.test(fErr.message) ? "Run supabase/reader-pages.sql in Supabase first." : fErr.message }, 500);
  if (!f) return json({ error: "File not found." }, 404);
  if (f.file_type !== "pdf") return json({ error: "Only PDFs can be prepared for reading (ZIP files can't be shown in the browser)." }, 400);

  const fail = async (msg: string) => {
    await db.from("product_files").update({ pages_status: "failed", pages_error: msg.slice(0, 300), pages_updated_at: new Date().toISOString() }).eq("id", id);
    open.delete(`${id}:${f.file_path}`);
    reportFailure("reader", "PDF pages could not be prepared", msg, { file: String(id).slice(0, 8) });
    return json({ error: msg }, 500);
  };

  let pdf: OpenPdf;
  try {
    pdf = await getPdf(`${id}:${f.file_path}`, async () => {
      const { data: blob, error } = await db.storage.from("materials").download(f.file_path as string);
      if (error || !blob) throw new Error("The original PDF could not be read from storage.");
      return new Uint8Array(await blob.arrayBuffer());
    });
  } catch (e) {
    const m = (e as Error).message;
    return fail(/password/i.test(m) ? "This PDF is password-protected. Please upload it without a password." : /Invalid PDF|corrupt|structure/i.test(m) ? "This PDF looks damaged. Please export it again and re-upload." : m);
  }

  // Start (again): a fresh version folder, counters reset
  let version = Number(f.pages_version ?? 0);
  let bytes = Number(f.pages_bytes ?? 0);
  if (from === 1) {
    version += 1;
    bytes = 0;
    const { error } = await db
      .from("product_files")
      .update({ pages_status: "processing", pages_done: 0, pages_bytes: 0, pages_error: null, page_count: pdf.pages, pages_version: version, pages_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return json({ error: error.message }, 500);
  }

  let done = from - 1;
  try {
    for (let n = from; n <= pdf.pages; n++) {
      const webp = await pdf.render(n);
      const { error } = await db.storage.from(PAGES_BUCKET).upload(pagePath(id, version, n), webp, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
      if (error) throw new Error(/bucket/i.test(error.message) ? "Run supabase/reader-pages.sql in Supabase first (the 'reader-pages' storage bucket is missing)." : `Upload of page ${n} failed: ${error.message}`);
      bytes += webp.length;
      done = n;
      if (Date.now() - started > TIME_BUDGET_MS) break;
    }
  } catch (e) {
    return fail((e as Error).message);
  }

  const finished = done >= pdf.pages;
  await db
    .from("product_files")
    .update({ pages_done: done, pages_bytes: bytes, pages_status: finished ? "ready" : "processing", pages_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (finished) {
    open.delete(`${id}:${f.file_path}`);
    void pdf.close().catch(() => {});
    await removePages(db, id, version).catch(() => {}); // older versions
  }
  return json({ pageCount: pdf.pages, done, finished, nextFrom: done + 1, bytes, version });
}
