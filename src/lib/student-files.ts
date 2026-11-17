// PDFs a student may open (server only). Uses the student's OWN login, so the
// database (Row Level Security + can_access_product) decides which files come back.
// The storage address of the original (file_path) is never selected.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubjectFile } from "@/components/files/SubjectFiles";

const BASE = "id,product_id,display_name,file_type,size_bytes,sort_order";

export async function loadStudentFiles(supabase: SupabaseClient, productIds: string[]): Promise<SubjectFile[]> {
  if (!productIds.length) return [];
  const q = (cols: string) =>
    supabase.from("product_files").select(cols).in("product_id", productIds).eq("file_type", "pdf").order("sort_order").order("created_at");
  let { data, error } = await q(`${BASE},subject,chapter`);
  if (error) ({ data, error } = await q(BASE)); // supabase/courses-question-bank.sql not run yet
  if (error) console.warn("loadStudentFiles:", error.message);
  return (data ?? []) as unknown as SubjectFile[];
}

/** Products (ids) this student may open — paid, free, or Question Bank through a bundle / crash course. null = SQL not run yet. */
export async function accessibleProducts(supabase: SupabaseClient, userId: string, productIds: string[]): Promise<Set<string> | null> {
  const out = new Set<string>();
  for (const id of productIds) {
    const { data, error } = await supabase.rpc("can_access_product", { p_user: userId, p_product: id });
    if (error) return null;
    if (data === true) out.add(id);
  }
  return out;
}

/** Group files by product id */
export function byProduct(files: SubjectFile[]) {
  const m = new Map<string, SubjectFile[]>();
  for (const f of files) m.set(f.product_id, [...(m.get(f.product_id) ?? []), f]);
  return m;
}
