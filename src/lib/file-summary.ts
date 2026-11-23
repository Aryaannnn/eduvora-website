// "45 PDFs · Physics, Chemistry, Mathematics" — what a product includes, built from
// its files. Only counts and subjects: no file names, no links (server only, cached;
// refreshed whenever files change in Admin → Products).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PDF_SUBJECTS, type PdfSubject } from "./product-files";
import { getAdminSupabase } from "./supabase/admin";

export type FileSummary = { pdfs: number; subjects: string[]; bySubject: Record<PdfSubject, number>; text: string };

export async function getFileSummary(productId: string): Promise<FileSummary | null> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const db = getAdminSupabase();
  if (!db) return null;
  const q = (cols: string) => db.from("product_files").select(cols).eq("product_id", productId).eq("file_type", "pdf");
  let { data, error } = await q("subject");
  if (error) ({ data, error } = await q("id")); // SQL not run yet → count only
  if (error) return null;
  const rows = (data ?? []) as unknown as { subject?: string | null }[];
  const bySubject = { physics: 0, chemistry: 0, mathematics: 0 } as Record<PdfSubject, number>;
  for (const r of rows) if (r.subject && r.subject in bySubject) bySubject[r.subject as PdfSubject]++;
  const subjects = PDF_SUBJECTS.filter((s) => bySubject[s.id] > 0).map((s) => s.label);
  const pdfs = rows.length;
  return { pdfs, subjects, bySubject, text: pdfs ? `${pdfs} PDF${pdfs === 1 ? "" : "s"}${subjects.length ? ` · ${subjects.join(", ")}` : ""}` : "" };
}

/** "Day-wise study plan included (60 days)" — real days only (SAMPLE days don't count). null = none / SQL not run. */
export async function getPlanSummary(productId: string): Promise<{ days: number } | null> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const db = getAdminSupabase();
  if (!db) return null;
  const { data, error } = await db.from("study_plan_days").select("day_number").eq("product_id", productId).eq("is_sample", false);
  if (error || !data?.length) return null;
  return { days: Math.max(...data.map((d) => Number(d.day_number) || 0)) };
}
