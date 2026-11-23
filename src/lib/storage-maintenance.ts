// =====================================================================
//  STORAGE HOUSEKEEPING (server only)
//  • dailyMaintenance(): run by the daily cron job —
//      watermarked copies older than 24 hours (and copies nothing points to),
//      the in-website reader's page pictures while the reader is switched off,
//      and old log rows (supabase/storage-cleanup.sql → purge_old_logs:
//      email / download / view logs 90 days, activity log 1 year).
//    Payments, purchases, bookings and invoices are never touched.
//  • Everything else (unused originals, ZIPs, duplicates) is only removed
//    after the admin confirms it in Admin → Settings → Storage & database.
// =====================================================================
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { cleanupCopies } from "./pdf-delivery";

export type CleanupReason = "zip_unused" | "orphan_original" | "duplicate" | "orphan_copy" | "old_copy" | "reader_page";
export type CleanupItem = { bucket: string; path: string; bytes: number; reason: CleanupReason; detail: string; keep_path: string | null };

/** What could be removed (supabase/storage-cleanup.sql). null = SQL not run yet. */
export async function cleanupList(db: SupabaseClient): Promise<CleanupItem[] | null> {
  const { data, error } = await db.rpc("storage_cleanup_list");
  if (error) return null;
  return ((data ?? []) as CleanupItem[]).map((r) => ({ ...r, bytes: Number(r.bytes) || 0 }));
}

/** Remove objects in batches; returns how many were removed. */
export async function removeObjects(db: SupabaseClient, bucket: string, paths: string[]) {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 500) {
    const part = paths.slice(i, i + 500);
    const { data, error } = await db.storage.from(bucket).remove(part);
    if (error) throw new Error(error.message);
    removed += data?.length ?? part.length;
  }
  return removed;
}

/** The daily job (cron). Never throws — returns a short summary. */
export async function dailyMaintenance(db: SupabaseClient) {
  const out: Record<string, unknown> = {};
  out.copiesRemoved = await cleanupCopies(db).catch(() => 0); // rows older than 24 h (+ their files)
  const list = await cleanupList(db).catch(() => null);
  if (list) {
    const copies = list.filter((i) => i.reason === "old_copy" || i.reason === "orphan_copy").map((i) => i.path);
    if (copies.length) {
      out.copyFilesRemoved = await removeObjects(db, "watermarked", copies).catch(() => 0);
      for (let i = 0; i < copies.length; i += 200) await db.from("pdf_copies").delete().in("storage_path", copies.slice(i, i + 200));
    }
    if (!siteConfig.inWebsiteReader) {
      const pages = list.filter((i) => i.reason === "reader_page").map((i) => i.path);
      if (pages.length) out.readerPagesRemoved = await removeObjects(db, "reader-pages", pages).catch(() => 0);
      await db.from("product_files").update({ pages_status: "none", pages_done: 0, pages_bytes: 0 }).neq("pages_status", "none").then(() => null, () => null);
    }
  } else out.cleanup = "run supabase/storage-cleanup.sql";
  const { data: logs, error } = await db.rpc("purge_old_logs");
  out.logsDeleted = error ? "run supabase/storage-cleanup.sql" : logs;
  return out;
}
