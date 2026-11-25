"use server";

// =====================================================================
//  ADMIN — PRODUCT FILES (PDF / ZIP). Every action checks the admin role
//  on the server first. Files go to the PRIVATE 'materials' bucket in a
//  folder per product:  materials/<product id>/<name>-<random>.pdf
// =====================================================================
import { randomBytes } from "node:crypto";
import { updateTag } from "next/cache";
import { adminOrError, isError, type ActionResult } from "@/lib/admin";
import { checkFile, isPcmSubject, isPdfSubject, kindOf, MIME, niceName, slugName, subjectLabel, subjectsForSlug, type PdfSubject, type ProductFile } from "@/lib/product-files";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { removePages } from "@/lib/pdf-pages";
import { clearCopiesOfFile } from "@/lib/pdf-delivery";
import { existingCopy, hashStored, removeIfUnused } from "@/lib/storage-files";

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

/** English & Aptitude belongs to the crash courses only — not the Formula Book or the Question Bank. null = fine. */
async function subjectNotAllowed(db: NonNullable<ReturnType<typeof getAdminSupabase>>, productId: string, subject: string | null | undefined): Promise<string | null> {
  if (!subject || isPcmSubject(subject)) return null;
  const { data: p } = await db.from("products").select("slug,category").eq("id", productId).maybeSingle();
  if (!p) return "Product not found.";
  if (p.category !== "crash_course" || !subjectsForSlug(p.slug as string).some((x) => x.id === subject)) return `${subjectLabel(subject)} is only for the crash courses. Please choose Physics, Chemistry or Mathematics.`;
  return null;
}
/** The database refused the subject → which SQL file adds it */
const subjectSqlHint = (subject?: string | null) =>
  subject === "english_aptitude" ? "Run supabase/english-aptitude.sql in Supabase first (it adds the English & Aptitude subject)." : "Run supabase/courses-question-bank.sql in Supabase first.";

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
export async function finishFileUpload(input: { productId: string; path: string; fileName: string; size: number; replaceId?: string; subject?: string }): Promise<ActionResult<{ file: ProductFile }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { productId, path, fileName, size, replaceId } = input;
  const subject = isPdfSubject(input.subject) ? input.subject : null;
  if (!isId(productId) || !path.startsWith(`${productId}/`)) return fail("Invalid upload.");
  const subjectProblem = await subjectNotAllowed(db, productId, subject);
  if (subjectProblem) return fail(subjectProblem);
  const kind = kindOf(path);
  if (!kind) return fail("Only PDF and ZIP files are allowed.");

  // Make sure the file really arrived in storage
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: found } = await db.storage.from(BUCKET).list(folder, { search: name, limit: 1 });
  const stored = found?.find((o) => o.name === name);
  if (!stored) return fail("The upload did not finish. Please try again.");
  const realSize = Number((stored.metadata as { size?: number } | null)?.size ?? size);

  // Identical PDF already stored (any product)? → keep ONE copy: remove this upload, reuse the existing file
  const hash = await hashStored(db, path).catch(() => null);
  const reuse = await existingCopy(db, hash, path).catch(() => null);
  let filePath = reuse ?? path;
  const withHash = (row: Record<string, unknown>) => (hash ? { ...row, content_hash: hash } : row);
  const noHashColumn = (msg: string) => /content_hash/.test(msg);
  // (before supabase/storage-cleanup.sql a stored file can't be shared → keep this upload instead)
  const sharedNotAllowed = (msg: string) => !!reuse && /file_path|duplicate key/i.test(msg);
  // the new upload is removed only AFTER the database accepted the shared copy
  const dropUploadIfReused = async () => {
    if (filePath !== path) await db.storage.from(BUCKET).remove([path]);
  };

  if (replaceId) {
    const { data: old } = await db.from("product_files").select("id,file_path,product_id").eq("id", replaceId).maybeSingle();
    if (!old || old.product_id !== productId) return fail("File not found.");
    const patch = { file_path: filePath, file_type: kind, size_bytes: realSize, created_at: new Date().toISOString() };
    let { data: row, error } = await db.from("product_files").update(withHash(patch)).eq("id", replaceId).select("*").single();
    if (error && noHashColumn(error.message)) ({ data: row, error } = await db.from("product_files").update(patch).eq("id", replaceId).select("*").single());
    if (error && sharedNotAllowed(error.message)) {
      filePath = path;
      ({ data: row, error } = await db.from("product_files").update({ ...patch, file_path: path }).eq("id", replaceId).select("*").single());
    }
    if (error) return fail(error.message);
    await dropUploadIfReused();
    if (old.file_path !== filePath) await removeIfUnused(db, old.file_path); // other products may share it
    await clearCopiesOfFile(db, replaceId).catch(() => {}); // students' watermarked copies of the OLD file
    await syncProductFilePath(db, productId);
    return { ok: true, data: { file: row as ProductFile }, message: `File replaced. Students get the new version from now on.${filePath !== path ? " (This PDF was already stored, so the existing copy is reused — no extra space used.)" : ""}` };
  }

  const { data: last } = await db.from("product_files").select("sort_order").eq("product_id", productId).order("sort_order", { ascending: false }).limit(1);
  const newRow = { product_id: productId, display_name: niceName(fileName), file_path: filePath, file_type: kind, size_bytes: realSize, sort_order: (last?.[0]?.sort_order ?? -1) + 1, ...(subject ? { subject } : {}) };
  let { data: row, error } = await db.from("product_files").insert(withHash(newRow)).select("*").single();
  if (error && noHashColumn(error.message)) ({ data: row, error } = await db.from("product_files").insert(newRow).select("*").single());
  if (error && sharedNotAllowed(error.message)) {
    filePath = path;
    ({ data: row, error } = await db.from("product_files").insert(withHash({ ...newRow, file_path: path })).select("*").single());
  }
  if (error) {
    await db.storage.from(BUCKET).remove([path]); // this upload is not used
    return fail(/subject/.test(error.message) ? subjectSqlHint(subject) : /product_files/.test(error.message) ? "Run supabase/product-files.sql in Supabase first." : error.message);
  }
  await dropUploadIfReused();
  await syncProductFilePath(db, productId);
  return { ok: true, data: { file: row as ProductFile }, ...(filePath !== path ? { message: "This PDF was already stored, so the existing copy is reused — no extra space used." } : {}) };
}

/** Subject (Physics / Chemistry / Mathematics) and chapter / day label of one PDF. */
export async function updateFileInfo(id: string, info: { subject?: string | null; chapter?: string | null }): Promise<ActionResult> {
  const db = await adminDb();
  if ("ok" in db) return db;
  if (!isId(id)) return fail("File not found.");
  const patch: Record<string, string | null> = {};
  if (info.subject !== undefined) {
    if (info.subject && !isPdfSubject(info.subject)) return fail("Please choose a subject from the list.");
    if (info.subject) {
      const { data: file } = await db.from("product_files").select("product_id").eq("id", id).maybeSingle();
      const problem = file ? await subjectNotAllowed(db, file.product_id as string, info.subject) : "File not found.";
      if (problem) return fail(problem);
    }
    patch.subject = info.subject || null;
  }
  if (info.chapter !== undefined) patch.chapter = (info.chapter ?? "").trim().slice(0, 60) || null;
  const { error } = await db.from("product_files").update(patch).eq("id", id);
  if (error) return fail(/subject|chapter/.test(error.message) ? subjectSqlHint(info.subject) : error.message);
  updateTag("products"); // "45 PDFs · Physics, …" on the course page
  return { ok: true, message: "Saved." };
}

export type FileDestination = { value: string; label: string; group: string };
const MOVE_GROUPS: Record<string, string> = {
  crash_course: "Courses, Formula Book & Question Bank", // (each × Physics / Chemistry / Mathematics)
  study_material: "Study material",
  previous_paper: "Previous year papers",
};

/** Every place a PDF can be moved to: each crash course x subject, each Question Bank subject, study material, previous year papers. */
export async function listFileDestinations(): Promise<ActionResult<{ destinations: FileDestination[] }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data, error } = await db.from("products").select("*").in("category", Object.keys(MOVE_GROUPS)).order("sort_order").order("created_at");
  if (error) return fail(error.message);
  const out: FileDestination[] = [];
  for (const cat of Object.keys(MOVE_GROUPS)) {
    for (const p of (data ?? []).filter((x) => x.category === cat)) {
      const hidden = p.is_active ? "" : " (hidden)";
      if (cat === "crash_course") {
        // crash courses: Physics, Chemistry, Mathematics, English & Aptitude · Formula Book / Question Bank: the first three
        for (const s of subjectsForSlug(p.slug)) out.push({ value: `${p.id}:${s.id}`, label: `${p.title} → ${s.label}${hidden}`, group: MOVE_GROUPS[cat] });
      } else if (cat === "question_bank") {
        if (p.subject === "pcm") continue; // the bundle opens the three subject banks — PDFs live in those
        out.push({ value: `${p.id}:${isPcmSubject(p.subject) ? p.subject : ""}`, label: `${p.title}${hidden}`, group: MOVE_GROUPS[cat] });
      } else out.push({ value: `${p.id}:`, label: `${p.title}${p.college ? ` · ${p.college}` : ""}${hidden}`, group: MOVE_GROUPS[cat] });
    }
  }
  return { ok: true, data: { destinations: out } };
}

/** Move one or more PDFs to another product (and subject). Takes effect at once; logged in the Activity Log. */
export async function moveProductFiles(ids: string[], destination: string): Promise<ActionResult<{ moved: number }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const db = getAdminSupabase();
  if (!db) return fail("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local.");
  const [toProduct = "", rawSubject] = destination.split(":");
  const list = [...new Set(ids)].filter(isId).slice(0, 200);
  if (!list.length) return fail("Please tick at least one PDF.");
  if (!isId(toProduct)) return fail("Please choose where to move the PDFs.");
  const { data: dest } = await db.from("products").select("*").eq("id", toProduct).maybeSingle();
  if (!dest || !(dest.category in MOVE_GROUPS)) return fail("That destination doesn't exist any more.");
  const subject: PdfSubject | null =
    dest.category === "crash_course" ? (subjectsForSlug(dest.slug).some((x) => x.id === rawSubject) ? (rawSubject as PdfSubject) : null) : dest.category === "question_bank" && isPcmSubject(dest.subject) ? dest.subject : null;
  if (dest.category === "crash_course" && !subject) return fail("Please choose a subject for the crash course.");

  const { data: files, error: fErr } = await db.from("product_files").select("id,product_id,display_name").in("id", list);
  if (fErr) return fail(fErr.message);
  if (!files?.length) return fail("Those PDFs were not found.");
  const { data: last } = await db.from("product_files").select("sort_order").eq("product_id", toProduct).order("sort_order", { ascending: false }).limit(1);
  let order = (last?.[0]?.sort_order ?? -1) + 1;
  const fromProducts = new Set<string>();
  for (const f of files) {
    const patch: Record<string, unknown> = { product_id: toProduct, subject };
    if (f.product_id !== toProduct) patch.sort_order = order++; // goes to the end of the list there
    const { error } = await db.from("product_files").update(patch).eq("id", f.id);
    if (error) return fail(/subject/.test(error.message) ? "Run supabase/courses-question-bank.sql in Supabase first." : error.message);
    fromProducts.add(f.product_id as string);
  }
  for (const p of new Set([...fromProducts, toProduct])) await syncProductFilePath(db, p);

  const { data: fromRows } = await db.from("products").select("title").in("id", [...fromProducts]);
  const where = `${dest.title}${dest.category === "crash_course" && subject ? ` → ${subjectLabel(subject)}` : ""}`;
  await s.supabase
    .rpc("log_admin_event", {
      p_action: "files.move",
      p_summary: `Moved ${files.length} PDF${files.length === 1 ? "" : "s"} from ${(fromRows ?? []).map((r) => r.title).join(", ") || "?"} to ${where}`,
      p_details: { files: files.map((f) => f.display_name).slice(0, 50), file_ids: files.map((f) => f.id), from: [...fromProducts], to: toProduct, subject },
    })
    .then(() => null, () => null);
  return { ok: true, data: { moved: files.length }, message: `Moved ${files.length} PDF${files.length === 1 ? "" : "s"} to ${where}.` };
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
  await clearCopiesOfFile(db, id).catch(() => {}); // students' watermarked copies
  const { error } = await db.from("product_files").delete().eq("id", id);
  if (error) return fail(error.message);
  await syncProductFilePath(db, f.product_id);
  await removeIfUnused(db, f.file_path); // identical PDFs in other products share the stored copy
  await removePages(db, id).catch(() => {}); // its reader page pictures too
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

export async function listProductFiles(productId: string): Promise<ActionResult<{ files: ProductFile[] }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data, error } = await db.from("product_files").select("*").eq("product_id", productId).order("sort_order").order("created_at");
  if (error) return fail(/product_files/.test(error.message) ? "Run supabase/product-files.sql in Supabase to turn on file uploads." : error.message);
  return { ok: true, data: { files: (data ?? []) as ProductFile[] } };
}

/** Admin → Products → "Process all PDFs": every PDF and whether its reader pages are ready. */
export async function listPdfsForReader(): Promise<ActionResult<{ files: { id: string; name: string; product: string; status: string }[] }>> {
  const db = await adminDb();
  if ("ok" in db) return db;
  const { data, error } = await db.from("product_files").select("id,display_name,pages_status,products(title)").eq("file_type", "pdf").order("created_at");
  if (error) return fail(/pages_status/.test(error.message) ? "Run supabase/reader-pages.sql in Supabase first." : error.message);
  return {
    ok: true,
    data: {
      files: (data ?? []).map((f) => ({
        id: f.id as string,
        name: f.display_name as string,
        product: (f.products as unknown as { title?: string } | null)?.title ?? "",
        status: (f.pages_status as string) ?? "none",
      })),
    },
  };
}
