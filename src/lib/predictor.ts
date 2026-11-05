// =====================================================================
//  VITEEE RANK & COLLEGE PREDICTOR — the calculation (used everywhere)
//  Pure functions only: no database, no React. Tested by
//  scripts/test-predictor.mjs  →  run:  npm run test:predictor
// =====================================================================

export const MAX_MARKS = 125;
/** How many marks of "uncertainty" we allow either side when turning marks into a rank range */
export const MARKS_SPREAD = 2;

export type RankBand = { min_marks: number; max_marks: number; min_rank: number; max_rank: number };
export type Cutoff = { id?: string; campus: string; branch: string; fee_category: number; counselling_phase: number; closing_rank: number };
export type Chance = "high" | "moderate" | "low";

export type Prediction = {
  source: "marks" | "rank";
  marks: number | null;
  rank: number; // best single estimate
  minRank: number; // best case (smaller number)
  maxRank: number; // worst case (bigger number)
  /** "ok" = marks inside the data; "above"/"below" = outside it, result is the nearest known value */
  coverage: "ok" | "above" | "below";
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Rank for an exact number of marks, by straight-line (linear) interpolation
 * inside the band that contains the marks.
 * Higher marks → smaller (better) rank. Returns null if there is no data.
 */
export function rankAtMarks(marks: number, bands: RankBand[]): { rank: number; coverage: Prediction["coverage"] } | null {
  const list = bands
    .map((b) => ({ min_marks: +b.min_marks, max_marks: +b.max_marks, min_rank: +b.min_rank, max_rank: +b.max_rank }))
    .filter((b) => Number.isFinite(b.min_marks) && Number.isFinite(b.max_marks) && b.max_marks >= b.min_marks)
    .sort((a, b) => a.min_marks - b.min_marks);
  if (list.length === 0 || !Number.isFinite(marks)) return null;
  const m = clamp(marks, 0, MAX_MARKS);

  const lowest = list[0];
  const highest = list[list.length - 1];
  if (m < lowest.min_marks) return { rank: lowest.max_rank, coverage: "below" };
  if (m > highest.max_marks) return { rank: highest.min_rank, coverage: "above" };

  // Inside a band — if marks sit on a shared edge, prefer the HIGHER band (better rank),
  // which keeps the result continuous when bands touch (e.g. 100 belongs to 100–110).
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (m >= b.min_marks && m <= b.max_marks) {
      if (b.max_marks === b.min_marks) return { rank: b.min_rank, coverage: "ok" };
      const t = (m - b.min_marks) / (b.max_marks - b.min_marks); // 0 at min_marks … 1 at max_marks
      return { rank: b.max_rank - t * (b.max_rank - b.min_rank), coverage: "ok" };
    }
  }

  // In a gap between two bands: draw a straight line across the gap
  for (let i = 0; i < list.length - 1; i++) {
    const lo = list[i];
    const hi = list[i + 1];
    if (m > lo.max_marks && m < hi.min_marks) {
      const t = (m - lo.max_marks) / (hi.min_marks - lo.max_marks);
      return { rank: lo.min_rank + t * (hi.max_rank - lo.min_rank), coverage: "ok" };
    }
  }
  return null;
}

/** Predicted rank RANGE for the student's expected marks (± MARKS_SPREAD marks). */
export function predictFromMarks(marks: number, bands: RankBand[], spread = MARKS_SPREAD): Prediction | null {
  if (!Number.isFinite(marks)) return null;
  const m = clamp(marks, 0, MAX_MARKS);
  const mid = rankAtMarks(m, bands);
  if (!mid) return null;
  const best = rankAtMarks(Math.min(m + spread, MAX_MARKS), bands)!; // a few more marks → better rank
  const worst = rankAtMarks(Math.max(m - spread, 0), bands)!; // a few fewer marks → worse rank
  const minRank = Math.max(1, roundDown(best.rank));
  const maxRank = Math.max(minRank, roundUp(worst.rank));
  const rank = clamp(Math.round(mid.rank), minRank, maxRank);
  return { source: "marks", marks: m, rank, minRank, maxRank, coverage: mid.coverage };
}

/** When the student already knows their rank. */
export function predictFromRank(rank: number): Prediction | null {
  if (!Number.isFinite(rank) || rank < 1) return null;
  const r = Math.round(rank);
  return { source: "rank", marks: null, rank: r, minRank: r, maxRank: r, coverage: "ok" };
}

// Round ranks to "nice" numbers so we don't pretend to be more precise than we are
function step(n: number) {
  return n < 1000 ? 10 : n < 10000 ? 50 : 100;
}
function roundDown(n: number) {
  const s = step(n);
  return Math.max(1, Math.floor(n / s) * s);
}
function roundUp(n: number) {
  const s = step(n);
  return Math.ceil(n / s) * s;
}

/**
 * Chance of getting a seat, comparing the predicted range with the closing rank.
 *  High      — even the WORST predicted rank is comfortably inside (≤ 90% of closing rank)
 *  Moderate  — the BEST predicted rank is within 10% of the closing rank (borderline)
 *  Low       — otherwise
 */
export function chanceFor(p: Pick<Prediction, "minRank" | "maxRank">, closingRank: number): Chance {
  if (p.maxRank <= closingRank * 0.9) return "high";
  if (p.minRank <= closingRank * 1.1) return "moderate";
  return "low";
}

export const CHANCE_LABEL: Record<Chance, string> = { high: "High Chance", moderate: "Moderate Chance", low: "Low Chance" };
const CHANCE_ORDER: Record<Chance, number> = { high: 0, moderate: 1, low: 2 };

export type CollegeMatch = Cutoff & { chance: Chance };

/** All campus + branch options with a chance label, best options first. */
export function matchColleges(
  p: Pick<Prediction, "minRank" | "maxRank">,
  cutoffs: Cutoff[],
  filters: { campus?: string; branch?: string; feeCategory?: number } = {},
): CollegeMatch[] {
  return cutoffs
    .filter(
      (c) =>
        (!filters.campus || c.campus === filters.campus) &&
        (!filters.branch || c.branch === filters.branch) &&
        (!filters.feeCategory || Number(c.fee_category) === filters.feeCategory),
    )
    .map((c) => ({ ...c, chance: chanceFor(p, Number(c.closing_rank)) }))
    .sort(
      (a, b) =>
        CHANCE_ORDER[a.chance] - CHANCE_ORDER[b.chance] ||
        Number(a.closing_rank) - Number(b.closing_rank) || // more competitive (better) options first
        Number(a.fee_category) - Number(b.fee_category),
    );
}

/** A few good matches for the public preview: prefer High, then Moderate. */
export function previewMatches(p: Pick<Prediction, "minRank" | "maxRank">, cutoffs: Cutoff[], count = 3): CollegeMatch[] {
  const all = matchColleges(p, cutoffs);
  const good = all.filter((m) => m.chance !== "low");
  // One row per campus+branch (the cheapest fee category that matches) so the preview is varied
  const seen = new Set<string>();
  const unique: CollegeMatch[] = [];
  for (const m of (good.length ? good : all)) {
    const key = `${m.campus}|${m.branch}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
    if (unique.length === count) break;
  }
  return unique;
}

/** Where this rank sits among everyone in the data (0–100, higher = better). Used for the gauge. */
export function percentileFor(rank: number, bands: RankBand[]): number {
  const worst = Math.max(...bands.map((b) => +b.max_rank), rank, 1);
  return clamp(Math.round((1 - (rank - 1) / worst) * 1000) / 10, 0, 100);
}
