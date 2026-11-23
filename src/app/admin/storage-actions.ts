"use server";

// =====================================================================
//  ADMIN → SETTINGS → STORAGE & DATABASE (admin only, checked on the server)
//  • scanStorage(): what could be removed (unused ZIPs / originals, duplicate
//    PDFs, old or orphaned watermarked copies, reader page pictures)
//  • hashNextFiles(): fingerprints existing PDFs a few at a time (finds duplicates)
//  • deleteStorageItems(): removes ONLY what the admin ticked and confirmed —
//    every item is checked again against a fresh scan first. Duplicates: the
//    products are pointed to the copy that is kept BEFORE the extra copy goes.
//    Payments, invoices and the 'assets' / 'invoices' buckets are never touched.
// =====================================================================
import { updateTag } from "next/cache";
import { adminOrError, isError, type ActionResult } from "@/lib/admin";
import { cleanupList, removeObjects, type CleanupItem } from "@/lib/storage-maintenance";
import { hashStored } from "@/lib/storage-files";
import { getAdminSupabase } from "@/lib/supabase/admin";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const SQL_MISSING = "Run supabase/storage-cleanup.sql in Supabase first.";
const DELETABLE = new Set(["materials", "watermarked", "reader-pages"]);

async function admin() {
  const s = await adminOrError();
  if (isError(s)) return s;
  const db = getAdminSupabase();
  if (!db) return { ok: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is missing in .env.local." };
  return { s, db };
}

export async function scanStorage(): Promise<ActionResult<{ items: CleanupItem[]; unhashed: number }>> {
  const a = await admin();
  if ("ok" in a) return a;
  const items = await cleanupList(a.db);
  if (!items) return fail(SQL_MISSING);
  const { count } = await a.db.from("product_files").select("id", { count: "exact", head: true }).is("content_hash", null);
  return { ok: true, data: { items: items.slice(0, 5000), unhashed: count ?? 0 } };
}

/** Fingerprint up to 3 PDFs that have none yet (the browser calls this again until "remaining" is 0). */
export async function hashNextFiles(): Promise<ActionResult<{ done: number; remaining: number }>> {
  const a = await admin();
  if ("ok" in a) return a;
  const { data, error } = await a.db.from("product_files").select("id,file_path").is("content_hash", null).order("created_at").limit(3);
  if (error) return fail(/content_hash/.test(error.message) ? SQL_MISSING : error.message);
  let done = 0;
  for (const f of data ?? []) {
    const hash = await hashStored(a.db, f.file_path as string).catch(() => null);
    // a file that can't be read gets "missing" so it isn't tried again and again
    await a.db.from("product_files").update({ content_hash: hash ?? "missing" }).eq("id", f.id);
    done++;
  }
  const { count } = await a.db.from("product_files").select("id", { count: "exact", head: true }).is("content_hash", null);
  return { ok: true, data: { done, remaining: count ?? 0 } };
}

/** Delete exactly the ticked items ("bucket:path"), after checking each one again. */
export async function deleteStorageItems(keys: string[]): Promise<ActionResult<{ removed: number; bytes: number }>> {
  const a = await admin();
  if ("ok" in a) return a;
  const { s, db } = a;
  const wanted = new Set(keys.slice(0, 5000));
  const fresh = await cleanupList(db);
  if (!fresh) return fail(SQL_MISSING);
  const items = fresh.filter((i) => wanted.has(`${i.bucket}:${i.path}`) && DELETABLE.has(i.bucket) && i.path !== "missing");
  if (!items.length) return fail("Nothing to delete — the list changed. Please scan again.");

  // Duplicates: point every product file / product at the copy that is kept, first
  for (const d of items.filter((i) => i.reason === "duplicate" && i.keep_path && i.keep_path !== i.path)) {
    await db.from("product_files").update({ file_path: d.keep_path }).eq("file_path", d.path);
    await db.from("products").update({ file_path: d.keep_path }).eq("file_path", d.path);
  }
  // Originals: only files nothing uses any more (checked again right now)
  const originals: string[] = [];
  for (const i of items.filter((x) => x.bucket === "materials")) {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      db.from("product_files").select("id", { count: "exact", head: true }).eq("file_path", i.path),
      db.from("products").select("id", { count: "exact", head: true }).eq("file_path", i.path),
    ]);
    if ((c1 ?? 0) + (c2 ?? 0) === 0) originals.push(i.path);
  }
  const copies = items.filter((i) => i.bucket === "watermarked").map((i) => i.path);
  const pages = items.filter((i) => i.bucket === "reader-pages").map((i) => i.path);
  const done = new Set([...originals.map((p) => `materials:${p}`), ...copies.map((p) => `watermarked:${p}`), ...pages.map((p) => `reader-pages:${p}`)]);

  let removed = 0;
  try {
    if (originals.length) removed += await removeObjects(db, "materials", originals);
    if (copies.length) {
      removed += await removeObjects(db, "watermarked", copies);
      for (let i = 0; i < copies.length; i += 200) await db.from("pdf_copies").delete().in("storage_path", copies.slice(i, i + 200));
    }
    if (pages.length) {
      removed += await removeObjects(db, "reader-pages", pages);
      await db.from("product_files").update({ pages_status: "none", pages_done: 0, pages_bytes: 0 }).neq("pages_status", "none");
    }
  } catch (e) {
    return fail(`Some files could not be deleted: ${(e as Error).message}`);
  }
  const bytes = items.filter((i) => done.has(`${i.bucket}:${i.path}`)).reduce((n, i) => n + i.bytes, 0);
  updateTag("products");
  await s.supabase
    .rpc("log_admin_event", {
      p_action: "storage.cleanup",
      p_summary: `Storage clean-up: removed ${removed} file${removed === 1 ? "" : "s"} (${(bytes / 1048576).toFixed(1)} MB)`,
      p_details: { removed, bytes, reasons: [...new Set(items.map((i) => i.reason))] },
    })
    .then(() => null, () => null);
  return { ok: true, data: { removed, bytes }, message: `Removed ${removed} file${removed === 1 ? "" : "s"}.` };
}
