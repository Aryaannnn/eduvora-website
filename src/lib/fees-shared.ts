// Fee calculator maths — shared by the page (browser) and admin.
// Data: supabase/fees-campuses.sql (edit in Admin → Settings → Fees & Campuses).

export type Campus = {
  id: string; name: string; location: string | null; branches: string[]; hostel_fee_min: number | null; hostel_fee_max: number | null;
  notes: string | null; website: string | null; sort_order: number; is_sample: boolean;
};
export type CampusFee = {
  id: string; year: number; campus: string; fee_category: number; rank_from: number; rank_to: number | null; tuition_per_year: number; notes: string | null; is_sample: boolean;
};

export const FEE_NOTE = "Fees are estimates; confirm on the official VIT website.";
export const COURSE_YEARS = 4;

/** Newest year that has fee rows for this campus. */
export function latestYear(fees: CampusFee[], campus: string): number | null {
  const ys = fees.filter((f) => f.campus === campus).map((f) => f.year);
  return ys.length ? Math.max(...ys) : null;
}

export type FeeEstimate = {
  year: number;
  row: CampusFee;
  /** true when the rank is better than every band (→ best category) */
  aboveAll: boolean;
  /** true when the rank is worse than every band that has an upper limit */
  beyondAll: boolean;
  perYear: number;
  total: number;
  /** all categories of this campus/year, best first (for the table) */
  bands: CampusFee[];
};

/** Rank + campus → likely fee category and tuition (null when no data). */
export function estimateFee(fees: CampusFee[], campus: string, rank: number): FeeEstimate | null {
  const year = latestYear(fees, campus);
  if (!year || !Number.isFinite(rank) || rank < 1) return null;
  const bands = fees.filter((f) => f.campus === campus && f.year === year).sort((a, b) => a.rank_from - b.rank_from);
  if (!bands.length) return null;
  let row = bands.find((b) => rank >= b.rank_from && (b.rank_to === null || rank <= b.rank_to));
  const aboveAll = !row && rank < bands[0].rank_from;
  const beyondAll = !row && !aboveAll;
  if (!row) row = aboveAll ? bands[0] : bands[bands.length - 1];
  return { year, row, aboveAll, beyondAll, perYear: row.tuition_per_year, total: row.tuition_per_year * COURSE_YEARS, bands };
}

export const rupees = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
