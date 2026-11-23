"use server";

// Admin → Products → (course) → Study plan. Admin checked on the server; writes go
// through the admin's own login, so Row Level Security applies (admins only).
import { updateTag } from "next/cache";
import { adminOrError, isError, type ActionResult } from "@/lib/admin";
import { parseCsv, PLAN_DAY_COLUMNS, splitList, type PlanDay } from "@/lib/study-plan";

const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const isId = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
const SQL = "Run supabase/study-plans.sql in Supabase first.";
const sqlMissing = (m: string) => /study_plan_days/.test(m) && /exist|schema cache/i.test(m);

export type PlanDayInput = { id?: string; day_number: number; subjects: string[]; topics: string[]; file_ids: string[]; note: string };

export async function listPlanDays(productId: string): Promise<ActionResult<{ days: PlanDay[] }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data, error } = await s.supabase.from("study_plan_days").select(PLAN_DAY_COLUMNS).eq("product_id", productId).order("day_number").order("created_at");
  if (error) return fail(sqlMissing(error.message) ? SQL : error.message);
  return { ok: true, data: { days: (data ?? []) as PlanDay[] } };
}

function clean(productId: string, d: PlanDayInput) {
  const day = Math.floor(Number(d.day_number));
  if (!Number.isInteger(day) || day < 1 || day > 400) return "Day number must be between 1 and 400.";
  return {
    product_id: productId,
    day_number: day,
    subjects: (d.subjects ?? []).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 5),
    topics: (d.topics ?? []).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 20),
    file_ids: (d.file_ids ?? []).filter(isId).slice(0, 20),
    note: String(d.note ?? "").trim().slice(0, 1000) || null,
    is_sample: false, // edited by you → no longer a sample
  };
}

export async function savePlanDay(productId: string, input: PlanDayInput): Promise<ActionResult<{ day: PlanDay }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!isId(productId)) return fail("Save the product first.");
  const row = clean(productId, input);
  if (typeof row === "string") return fail(row);
  const q = input.id && isId(input.id)
    ? s.supabase.from("study_plan_days").update({ ...row, updated_at: new Date().toISOString() }).eq("id", input.id).eq("product_id", productId)
    : s.supabase.from("study_plan_days").insert(row);
  const { data, error } = await q.select(PLAN_DAY_COLUMNS).single();
  if (error) return fail(sqlMissing(error.message) ? SQL : error.message);
  updateTag("products");
  return { ok: true, data: { day: data as PlanDay }, message: "Day saved." };
}

export async function deletePlanDay(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("study_plan_days").delete().eq("id", id);
  if (error) return fail(error.message);
  updateTag("products");
  return { ok: true, message: "Day deleted." };
}

/** ↑ ↓: swap the day numbers of two days */
export async function swapPlanDays(a: string, b: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { data } = await s.supabase.from("study_plan_days").select("id,day_number,product_id").in("id", [a, b]);
  if (!data || data.length !== 2 || data[0].product_id !== data[1].product_id) return fail("Days not found.");
  const [x, y] = data;
  await s.supabase.from("study_plan_days").update({ day_number: y.day_number }).eq("id", x.id);
  await s.supabase.from("study_plan_days").update({ day_number: x.day_number }).eq("id", y.id);
  return { ok: true };
}

/**
 * CSV import: day,subjects,topics,pdfs,note (lists inside a cell separated by ;).
 * "pdfs" are matched to this course's PDFs by their title. replace = delete the
 * current days first (samples are always removed).
 */
export async function importPlanCsv(productId: string, csv: string, replace: boolean): Promise<ActionResult<{ added: number; warnings: string[] }>> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (!isId(productId)) return fail("Save the product first.");
  const rows = parseCsv(String(csv ?? "").slice(0, 500_000));
  if (rows.length < 2) return fail("The CSV is empty. First row: day,subjects,topics,pdfs,note");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (col("day") < 0) return fail('The first row must contain the column names, e.g. "day,subjects,topics,pdfs,note".');
  const { data: files } = await s.supabase.from("product_files").select("id,display_name").eq("product_id", productId);
  const byName = new Map((files ?? []).map((f) => [String(f.display_name).trim().toLowerCase(), f.id as string]));
  const warnings: string[] = [];
  const out = [];
  for (const [i, r] of rows.slice(1).entries()) {
    const get = (n: string) => (col(n) >= 0 ? String(r[col(n)] ?? "").trim() : "");
    const names = splitList(get("pdfs"));
    const fileIds = names.map((n) => byName.get(n.toLowerCase())).filter((x): x is string => !!x);
    for (const n of names) if (!byName.has(n.toLowerCase())) warnings.push(`Row ${i + 2}: no PDF called "${n}" in this course`);
    const row = clean(productId, { day_number: Number(get("day")), subjects: splitList(get("subjects")), topics: splitList(get("topics")), file_ids: fileIds, note: get("note") });
    if (typeof row === "string") return fail(`Row ${i + 2}: ${row}`);
    out.push(row);
  }
  if (out.length > 400) return fail("At most 400 days per course.");
  const del = s.supabase.from("study_plan_days").delete().eq("product_id", productId);
  const { error: dErr } = replace ? await del : await del.eq("is_sample", true);
  if (dErr) return fail(sqlMissing(dErr.message) ? SQL : dErr.message);
  const { error } = await s.supabase.from("study_plan_days").insert(out);
  if (error) return fail(error.message);
  updateTag("products");
  return { ok: true, data: { added: out.length, warnings: warnings.slice(0, 20) }, message: `Imported ${out.length} day${out.length === 1 ? "" : "s"}.` };
}
