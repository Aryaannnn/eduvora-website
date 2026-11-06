// =====================================================================
//  RANK & COLLEGE PREDICTOR — SERVER ONLY
//  • FREE (any logged-in student): predicted rank RANGE only.
//  • FULL (paid counselling booking, students an admin gave access to, and
//    admins): colleges, branches, chances, fee categories, filters, PDF.
//    The rule lives in Supabase: has_predictor_access() (predictor-access.sql)
//  • The real rank & cutoff data is read here with the server key and never
//    sent to the browser. The browser only receives the RESULT — and college
//    results only after the full-access check passes.
// =====================================================================
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { getSession } from "./dashboard";
import {
  MAX_MARKS,
  matchColleges,
  percentileFor,
  predictFromMarks,
  predictFromRank,
  previewMatches,
  type CollegeMatch,
  type Cutoff,
  type Prediction,
  type RankBand,
} from "./predictor";
import { getAdminSupabase } from "./supabase/admin";

/** allowed = FULL access (college list). loggedIn = may use the free rank part. */
export type PredictorAccess = { allowed: boolean; loggedIn: boolean };

/** Checked on EVERY predictor request. Fails closed (no access) on any error. */
export const getPredictorAccess = cache(async (): Promise<PredictorAccess> => {
  const session = await getSession();
  if (!session) return { allowed: false, loggedIn: false };
  if (session.profile?.role === "admin") return { allowed: true, loggedIn: true };
  const { data, error } = await session.supabase.rpc("has_predictor_access");
  if (error) {
    console.warn("[predictor] access check failed (did you run supabase/predictor-access.sql?):", error.message);
    return { allowed: false, loggedIn: true };
  }
  return { allowed: data === true, loggedIn: true };
});

// ---------- private data (cached on the server only) ----------
export type PredictorData = { activeYear: number | null; disclaimer: string; isSample: boolean; bands: RankBand[]; cutoffs: Cutoff[] };
const DEFAULT_DISCLAIMER = "This is an estimate based on previous year data. Actual rank and admission may differ.";

async function loadPredictorData(): Promise<PredictorData> {
  "use cache";
  cacheTag("predictor");
  const empty: PredictorData = { activeYear: null, disclaimer: DEFAULT_DISCLAIMER, isSample: false, bands: [], cutoffs: [] };
  const db = getAdminSupabase();
  if (!db) {
    cacheLife({ stale: 60, revalidate: 30, expire: 300 });
    return empty;
  }
  const { data: settings, error } = await db.from("predictor_settings").select("active_year,disclaimer_text").eq("id", 1).maybeSingle();
  if (error || !settings) {
    if (error) console.warn("[predictor] settings:", error.message);
    cacheLife({ stale: 60, revalidate: 30, expire: 300 });
    return empty;
  }
  const year = settings.active_year as number;
  const [bands, cutoffs] = await Promise.all([
    db.from("rank_data").select("min_marks,max_marks,min_rank,max_rank,is_sample").eq("year", year).order("min_marks"),
    db.from("college_cutoffs").select("campus,branch,fee_category,counselling_phase,closing_rank,is_sample").eq("year", year).order("closing_rank").limit(5000),
  ]);
  if (bands.error || cutoffs.error) {
    console.warn("[predictor] data:", (bands.error ?? cutoffs.error)?.message);
    cacheLife({ stale: 60, revalidate: 30, expire: 300 });
    return empty;
  }
  cacheLife("minutes");
  const b = (bands.data ?? []) as (RankBand & { is_sample: boolean })[];
  const c = (cutoffs.data ?? []) as (Cutoff & { is_sample: boolean })[];
  return {
    activeYear: year,
    disclaimer: (settings.disclaimer_text as string) || DEFAULT_DISCLAIMER,
    isSample: b.some((x) => x.is_sample) || c.some((x) => x.is_sample),
    bands: b.map((x) => ({ min_marks: +x.min_marks, max_marks: +x.max_marks, min_rank: +x.min_rank, max_rank: +x.max_rank })),
    cutoffs: c.map((x) => ({ campus: x.campus, branch: x.branch, fee_category: +x.fee_category, counselling_phase: +x.counselling_phase, closing_rank: +x.closing_rank })),
  };
}

/**
 * Server use only. NEVER pass this object (or its cutoffs) to a browser
 * component — send only optionsFrom(...) / runPrediction(...) results,
 * and college results only to users with full access.
 */
export async function loadPredictorDataOnServer() {
  return loadPredictorData();
}

/** What the tool needs to draw its inputs (no ranks, no cutoffs). */
export type PredictorOptions = {
  activeYear: number | null;
  disclaimer: string;
  isSample: boolean;
  hasData: boolean;
  campuses: string[];
  branchesByCampus: Record<string, string[]>;
};

/** Options for users WITHOUT full access: no campus or branch lists at all. */
export function basicOptionsFrom(data: PredictorData): PredictorOptions {
  return { activeYear: data.activeYear, disclaimer: data.disclaimer, isSample: data.isSample, hasData: data.bands.length > 0, campuses: [], branchesByCampus: {} };
}

/** Options for users WITH full access (campus & branch filter lists). */
export function optionsFrom(data: PredictorData): PredictorOptions {
  const byCampus: Record<string, Set<string>> = {};
  for (const c of data.cutoffs) (byCampus[c.campus] ??= new Set()).add(c.branch);
  return {
    activeYear: data.activeYear,
    disclaimer: data.disclaimer,
    isSample: data.isSample,
    hasData: data.bands.length > 0,
    campuses: Object.keys(byCampus),
    branchesByCampus: Object.fromEntries(Object.entries(byCampus).map(([k, v]) => [k, [...v].sort()])),
  };
}

// ---------- the calculation (runs on the server) ----------
export type PredictInput = { inputType: "marks" | "rank"; marks?: number; rank?: number; campus?: string; branch?: string; feeCategory?: number; full: boolean };
export type PredictResult = {
  prediction: Prediction | null;
  percentile: number;
  counts: { high: number; moderate: number; low: number };
  total: number;
  matches: CollegeMatch[]; // full (filtered) list in the dashboard, best 3 elsewhere
};

export function parsePredictInput(body: Record<string, unknown>): PredictInput | null {
  const inputType = body.inputType === "rank" ? "rank" : "marks";
  const marks = Number(body.marks);
  const rank = Number(body.rank);
  if (inputType === "marks" && !(Number.isFinite(marks) && marks >= 0 && marks <= MAX_MARKS)) return null;
  if (inputType === "rank" && !(Number.isInteger(rank) && rank >= 1 && rank <= 10_000_000)) return null;
  const str = (v: unknown) => (typeof v === "string" && v.length <= 120 ? v : undefined);
  const fee = Number(body.feeCategory);
  return {
    inputType,
    marks: inputType === "marks" ? marks : undefined,
    rank: inputType === "rank" ? rank : undefined,
    campus: str(body.campus) || undefined,
    branch: str(body.branch) || undefined,
    feeCategory: Number.isInteger(fee) && fee >= 1 && fee <= 5 ? fee : undefined,
    full: body.full === true,
  };
}

export function runPrediction(input: PredictInput, data: PredictorData): PredictResult {
  const prediction = input.inputType === "marks" ? predictFromMarks(input.marks!, data.bands) : predictFromRank(input.rank!);
  if (!prediction) return { prediction: null, percentile: 0, counts: { high: 0, moderate: 0, low: 0 }, total: 0, matches: [] };
  const filters = { campus: input.campus, branch: input.branch, feeCategory: input.feeCategory };
  const list = matchColleges(prediction, data.cutoffs, input.full ? filters : {});
  const counts = { high: 0, moderate: 0, low: 0 };
  for (const m of list) counts[m.chance]++;
  const bands = data.bands.length ? data.bands : [{ min_marks: 0, max_marks: MAX_MARKS, min_rank: 1, max_rank: Math.max(prediction.rank * 2, 100000) }];
  return {
    prediction,
    percentile: percentileFor(prediction.rank, bands),
    counts,
    total: list.length,
    matches: input.full ? list : previewMatches(prediction, data.cutoffs, 3),
  };
}
