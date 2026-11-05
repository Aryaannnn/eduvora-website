"use server";

// Admin actions for the Rank & College Predictor.
// Same protection as other admin actions: server role check + Supabase RLS.
import { updateTag } from "next/cache";
import { adminOrError, friendlyDbError, isError, type ActionResult } from "@/lib/admin";

const CAMPUSES = ["VIT Vellore", "VIT Chennai", "VIT-AP", "VIT Bhopal"];
const fail = (error: string): ActionResult => ({ ok: false, error });
const done = (error: { message: string } | null, message: string): ActionResult => {
  updateTag("predictor");
  return error ? fail(friendlyError(error.message)) : { ok: true, message };
};
function friendlyError(m: string) {
  if (m.includes("college_cutoffs_unique")) return "A cutoff already exists for this year + campus + branch + fee category + phase.";
  if (m.includes("rank_data_marks_order")) return "Max marks must be the same or more than min marks.";
  if (m.includes("rank_data_rank_order")) return "Max rank (worst) must be the same or more than min rank (best).";
  return friendlyDbError(m);
}
const num = (v: unknown) => (v === "" || v === null || v === undefined ? NaN : Number(v));

// ---------- Settings ----------
export async function savePredictorSettings(input: { active_year: number | string; disclaimer_text: string }): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const year = num(input.active_year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fail("Enter a valid year, e.g. 2026.");
  if (!input.disclaimer_text?.trim()) return fail("The disclaimer can't be empty.");
  const { error } = await s.supabase
    .from("predictor_settings")
    .upsert({ id: 1, active_year: year, disclaimer_text: input.disclaimer_text.trim(), updated_at: new Date().toISOString() });
  return done(error, "Settings saved — the predictor now uses this year.");
}

// ---------- Marks → rank bands ----------
export type BandInput = { id?: string; year: number | string; min_marks: number | string; max_marks: number | string; min_rank: number | string; max_rank: number | string };

function cleanBand(b: BandInput): { row?: { year: number; min_marks: number; max_marks: number; min_rank: number; max_rank: number }; error?: string } {
  const row = { year: num(b.year), min_marks: num(b.min_marks), max_marks: num(b.max_marks), min_rank: num(b.min_rank), max_rank: num(b.max_rank) };
  if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) return { error: "year must be like 2026" };
  if (!(row.min_marks >= 0 && row.max_marks <= 125 && row.max_marks >= row.min_marks)) return { error: "marks must be 0–125 and max ≥ min" };
  if (!(Number.isInteger(row.min_rank) && Number.isInteger(row.max_rank) && row.min_rank >= 1 && row.max_rank >= row.min_rank))
    return { error: "ranks must be whole numbers ≥ 1, and max_rank (worst) ≥ min_rank (best)" };
  return { row };
}

export async function saveBand(b: BandInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { row, error: problem } = cleanBand(b);
  if (!row) return fail(`Check the values: ${problem}.`);
  const { error } = b.id
    ? await s.supabase.from("rank_data").update({ ...row, is_sample: false }).eq("id", b.id)
    : await s.supabase.from("rank_data").insert(row);
  return done(error, b.id ? "Row saved." : "Row added.");
}

export async function deleteBand(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("rank_data").delete().eq("id", id);
  return done(error, "Row deleted.");
}

export async function bulkBands(rows: BandInput[], replaceYears: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (rows.length === 0) return fail("The CSV has no rows.");
  if (rows.length > 2000) return fail("Please upload at most 2000 rows at a time.");
  const clean = rows.map((r, i) => ({ i, ...cleanBand(r) }));
  const bad = clean.filter((c) => c.error);
  if (bad.length) return fail(bad.slice(0, 8).map((c) => `Row ${c.i + 2}: ${c.error}`).join("\n") + (bad.length > 8 ? `\n…and ${bad.length - 8} more` : ""));
  const good = clean.map((c) => c.row!);
  const years = [...new Set(good.map((r) => r.year))];
  if (replaceYears) {
    const { error } = await s.supabase.from("rank_data").delete().in("year", years);
    if (error) return done(error, "");
  }
  const { error } = await s.supabase.from("rank_data").insert(good);
  return done(error, `${good.length} row(s) uploaded for ${years.join(", ")}${replaceYears ? " (old rows for these years replaced)" : ""}.`);
}

// ---------- College cutoffs ----------
export type CutoffInput = { id?: string; year: number | string; campus: string; branch: string; fee_category: number | string; counselling_phase: number | string; closing_rank: number | string };

function cleanCutoff(c: CutoffInput) {
  const row = {
    year: num(c.year),
    campus: String(c.campus ?? "").trim(),
    branch: String(c.branch ?? "").trim(),
    fee_category: num(c.fee_category),
    counselling_phase: c.counselling_phase === "" || c.counselling_phase === undefined ? 1 : num(c.counselling_phase),
    closing_rank: num(c.closing_rank),
  };
  // Accept small spelling differences, e.g. "vit vellore", "VIT AP"
  const match = CAMPUSES.find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === row.campus.toLowerCase().replace(/[^a-z]/g, ""));
  if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) return { error: "year must be like 2026" };
  if (!match) return { error: `campus must be one of: ${CAMPUSES.join(", ")}` };
  if (!row.branch) return { error: "branch is empty" };
  if (!Number.isInteger(row.fee_category) || row.fee_category < 1 || row.fee_category > 5) return { error: "fee_category must be 1 to 5" };
  if (!Number.isInteger(row.counselling_phase) || row.counselling_phase < 1 || row.counselling_phase > 10) return { error: "counselling_phase must be 1 to 10" };
  if (!Number.isInteger(row.closing_rank) || row.closing_rank < 1) return { error: "closing_rank must be a whole number ≥ 1" };
  return { row: { ...row, campus: match } };
}

export async function saveCutoff(c: CutoffInput): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { row, error: problem } = cleanCutoff(c);
  if (!row) return fail(`Check the values: ${problem}.`);
  const { error } = c.id
    ? await s.supabase.from("college_cutoffs").update({ ...row, is_sample: false }).eq("id", c.id)
    : await s.supabase.from("college_cutoffs").insert(row);
  return done(error, c.id ? "Cutoff saved." : "Cutoff added.");
}

export async function deleteCutoff(id: string): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const { error } = await s.supabase.from("college_cutoffs").delete().eq("id", id);
  return done(error, "Cutoff deleted.");
}

export async function bulkCutoffs(rows: CutoffInput[], replaceYears: boolean): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  if (rows.length === 0) return fail("The CSV has no rows.");
  if (rows.length > 5000) return fail("Please upload at most 5000 rows at a time.");
  const clean = rows.map((r, i) => ({ i, ...cleanCutoff(r) }));
  const bad = clean.filter((c) => c.error);
  if (bad.length) return fail(bad.slice(0, 8).map((c) => `Row ${c.i + 2}: ${c.error}`).join("\n") + (bad.length > 8 ? `\n…and ${bad.length - 8} more` : ""));
  const good = clean.map((c) => c.row!);
  const years = [...new Set(good.map((r) => r.year))];
  if (replaceYears) {
    const { error } = await s.supabase.from("college_cutoffs").delete().in("year", years);
    if (error) return done(error, "");
  }
  // Same year + campus + branch + category + phase → update the closing rank
  const { error } = await s.supabase
    .from("college_cutoffs")
    .upsert(good.map((r) => ({ ...r, is_sample: false })), { onConflict: "year,campus,branch,fee_category,counselling_phase" });
  return done(error, `${good.length} cutoff(s) uploaded for ${years.join(", ")}${replaceYears ? " (old rows for these years replaced)" : ""}.`);
}

// ---------- Sample data ----------
export async function deleteSampleData(): Promise<ActionResult> {
  const s = await adminOrError();
  if (isError(s)) return s;
  const a = await s.supabase.from("rank_data").delete().eq("is_sample", true);
  if (a.error) return done(a.error, "");
  const b = await s.supabase.from("college_cutoffs").delete().eq("is_sample", true);
  return done(b.error, "All SAMPLE rank data and cutoffs deleted. Upload your real data next.");
}
