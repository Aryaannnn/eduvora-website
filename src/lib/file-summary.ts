// "45 PDFs · Physics, Chemistry, Mathematics" — what a product includes, built from
// its files. Only counts and subjects: no file names, no links (server only, cached;
// refreshed whenever files change in Admin → Products).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PDF_SUBJECTS } from "./product-files";
import { getAdminSupabase } from "./supabase/admin";

export type FileSummary = { pdfs: number; subjects: string[]; text: string };

export async function getFileSummary(productId: string): Promise<FileSummary | null> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const db = getAdminSupabase();
  if (!db) return null;
  const q = (cols: string) => db.from("product_files").select(cols).eq("product_id", productId).eq("file_type", "pdf");
  let { data, error } = await q("subject");
  if (error) ({ data, error } = await q("id")); // SQL not run yet → count only
  if (error || !data?.length) return null;
  const rows = data as unknown as { subject?: string | null }[];
  const subjects = PDF_SUBJECTS.filter((s) => rows.some((r) => r.subject === s.id)).map((s) => s.label);
  const pdfs = rows.length;
  return { pdfs, subjects, text: `${pdfs} PDF${pdfs === 1 ? "" : "s"}${subjects.length ? ` · ${subjects.join(", ")}` : ""}` };
}
