// Stored originals ('materials' bucket) — identical PDFs are kept ONCE (server only).
import "server-only";
import { createHash } from "node:crypto";
import type { getAdminSupabase } from "./supabase/admin";

const BUCKET = "materials";
type Db = NonNullable<ReturnType<typeof getAdminSupabase>>;

/** sha256 of a stored file (finds identical PDFs). null if it can't be read. */
export async function hashStored(db: Db, path: string): Promise<string | null> {
  const { data: blob, error } = await db.storage.from(BUCKET).download(path);
  if (error || !blob) return null;
  return createHash("sha256").update(new Uint8Array(await blob.arrayBuffer())).digest("hex");
}

/** Remove a stored original only if NO product file / product still uses it (identical PDFs share one copy). */
export async function removeIfUnused(db: Db, path: string) {
  const [{ count: a }, { count: b }] = await Promise.all([
    db.from("product_files").select("id", { count: "exact", head: true }).eq("file_path", path),
    db.from("products").select("id", { count: "exact", head: true }).eq("file_path", path),
  ]);
  if ((a ?? 0) + (b ?? 0) === 0) await db.storage.from(BUCKET).remove([path]);
}

/** The same PDF already stored? → its path (the new upload is then removed and the existing copy reused). */
export async function existingCopy(db: Db, hash: string | null, newPath: string): Promise<string | null> {
  if (!hash) return null;
  const { data, error } = await db.from("product_files").select("file_path").eq("content_hash", hash).neq("file_path", newPath).order("created_at").limit(1);
  if (error || !data?.[0]) return null; // (no content_hash column before supabase/storage-cleanup.sql)
  const path = data[0].file_path as string;
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data: found } = await db.storage.from(BUCKET).list(folder, { search: path.slice(path.lastIndexOf("/") + 1), limit: 1 });
  return found?.length ? path : null;
}

