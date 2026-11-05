"use server";

// =====================================================================
//  ADMIN — PRODUCT FILES (PDF / ZIP). Every action checks the admin role
//  on the server first. Files go to the PRIVATE 'materials' bucket in a
//  folder per product:  materials/<product id>/<name>-<random>.pdf
// =====================================================================
import { randomBytes } from "node:crypto";
import { updateTag } from "next/cache";
import { adminOrError, isError, type ActionResult } from "@/lib/admin";
import { checkFile, kindOf, MIME, niceName, slugName, type ProductFile } from "@/lib/product-files";
import { getAdminSupabase } from "@/lib/supabase/admin";

const BUCKET = "materials";
const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function adminDb() {
  const s = await adminOrError();
  if (isError(s)) return s;
  const db = getAdminSupabase();
  if (!db) return { ok: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is missing in .env.local." };
  return db;
}

/** Keep products.file_path pointing at the first file (old "Download" buttons keep working). */
async function syncProductFilePath(db: NonNullable<ReturnType<typeof getAdminSupabase>>, productId: string) {
  const { data } = await db.from("product_files").select("file_path").eq("product_id", productId).order("sort_order").order("created_at").limit(1);
  await db.from("products").update({ file_path: data?.[0]?.file_path ?? null }).eq("id", productId);
  updateTag("products");
}

/** Step 1 of an upload: get a one-time upload link (the file goes straight from the browser to Supabase). */
export async function startFileUpload(productId: string, fileName: string, size: number, mime: string): Promise<ActionResult<{ path: string; token: string; contentType: string }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  if (!isId(productId)) return fail("Save the product first, then add files.");
  const problem = checkFile(fileName, size, mime);
  if (problem) return fail(problem);
  const kind = kindOf(fileName, mime)!;
  const path = `${productId}/${slugName(fileName)}-${randomBytes(4).toString("hex")}.${kind}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail(`Could not start the upload: ${error?.message ?? "unknown error"}`);
  return { ok: true, data: { path: data.path, token: data.token, contentType: MIME[kind] } };
}

/** Step 2: the file is in storage → save it in the list (or swap it in for "Replace"). */
export async function finishFileUpload(input: { productId: string; path: string; fileName: string; size: number; replaceId?: string }): Promise<ActionResult<{ file: ProductFile }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { productId, path, fileName, size, replaceId } = input;
  if (!isId(productId) || !path.startsWith(`${productId}/`)) return fail("Invalid upload.");
  const kind = kindOf(path);
  if (!kind) return fail("Only PDF and ZIP files are allowed.");

  // Make sure the file really arrived in storage
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: found } = await db.storage.from(BUCKET).list(folder, { search: name, limit: 1 });
  const stored = found?.find((o) => o.name === name);
  if (!stored) return fail("The upload did not finish. Please try again.");
  const realSize = Number((stored.metadata as { size?: number } | null)?.size ?? size);

  if (replaceId) {
    const { data: old } = await db.from("product_files").select("id,file_path,product_id").eq("id", replaceId).maybeSingle();
    if (!old || old.product_id !== productId) return fail("File not found.");
    const { data: row, error } = await db
      .from("product_files")
      .update({ file_path: path, file_type: kind, size_bytes: realSize, created_at: new Date().toISOString() })
      .eq("id", replaceId)
      .select("*")
      .single();
    if (error) return fail(error.message);
    await db.storage.from(BUCKET).remove([old.file_path]);
    await syncProductFilePath(db, productId);
    return { ok: true, data: { file: row as ProductFile }, message: "File replaced." };
  }

  const { data: last } = await db.from("product_files").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1);
  const { data: row, error } = await db
    .from("product_files")
    .insert({ product_id: productId, display_name: niceName(fileName), file_path: path, file_type: kind, size_bytes: realSize, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
    .select("*")
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return fail(/product_files/.test(error.message) ? "Run supabase/product-files.sql in Supabase first." : error.message);
  }
  await syncProductFilePath(db, productId);
  return { ok: true, data: { file: row as ProductFile } };
}

export async function renameProductFile(id: string, displayName: string): Promise<ActionResult> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const name = displayName.trim().slice(0, 120);
  if (!name) return fail("Please enter a name.");
  const { error } = await db.from("product_files").update({ display_name: name }).eq("id", id);
  return error ? fail(error.message) : { ok: true, message: "Renamed." };
}

export async function deleteProductFile(id: string): Promise<ActionResult> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data: f } = await db.from("product_files").select("file_path,product_id").eq("id", id).maybeSingle();
  if (!f) return fail("File not found.");
  const { error } = await db.from("product_files").delete().eq("id", id);
  if (error) return fail(error.message);
  await db.storage.from(BUCKET).remove([f.file_path]);
  await syncProductFilePath(db, f.product_id);
  return { ok: true, message: "File deleted." };
}

export async function reorderProductFiles(productId: string, orderedIds: string[]): Promise<ActionResult> {
  const db = await adminDb();
  if ("ok" in db) return db;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db.from("product_files").update({ sort_order: i }).eq("id", orderedIds[i]).eq("product_id", productId);
    if (error) return fail(error.message);
  }
  await syncProductFilePath(db, productId);
  return { ok: true, message: "Order saved." };
}

/** Admin preview: a 60-second link to open the PDF in the browser. */
export async function previewProductFile(id: string): Promise<ActionResult<{ url: string }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data: f } = await db.from("product_files").select("file_path").eq("id", id).maybeSingle();
  if (!f) return fail("File not found.");
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.file_path, 60);
  return error || !data ? fail("Could not open the file.") : { ok: true, data: { url: data.signedUrl } };
}

export async function listProductFiles(productId: string): Promise<ActionResult<{ files: ProductFile[] }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data, error } = await db.from("product_files").select("*").eq("product_id", productId).order("sort_order").order("created_at");
  if (error) return fail(/product_files/.test(error.message) ? "Run supabase/product-files.sql in Supabase to turn on file uploads." : error.message);
  return { ok: true, data: { files: (data ?? []) as ProductFile[] } };
}
