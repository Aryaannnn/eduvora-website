// Tests for the rank & college predictor calculation.
// Run with:  npm run test:predictor
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chanceFor,
  matchColleges,
  percentileFor,
  predictFromMarks,
  predictFromRank,
  previewMatches,
  rankAtMarks,
} from "../src/lib/predictor.ts";

// Same bands as the SAMPLE data in supabase/predictor.sql
const bands = [
  { min_marks: 110, max_marks: 125, min_rank: 1, max_rank: 500 },
  { min_marks: 100, max_marks: 110, min_rank: 500, max_rank: 1500 },
  { min_marks: 90, max_marks: 100, min_rank: 1500, max_rank: 4000 },
  { min_marks: 80, max_marks: 90, min_rank: 4000, max_rank: 8000 },
  { min_marks: 70, max_marks: 80, min_rank: 8000, max_rank: 15000 },
  { min_marks: 60, max_marks: 70, min_rank: 15000, max_rank: 25000 },
  { min_marks: 50, max_marks: 60, min_rank: 25000, max_rank: 40000 },
  { min_marks: 40, max_marks: 50, min_rank: 40000, max_rank: 60000 },
  { min_marks: 30, max_marks: 40, min_rank: 60000, max_rank: 85000 },
  { min_marks: 0, max_marks: 30, min_rank: 85000, max_rank: 120000 },
];

test("exact band edges give the band's ranks", () => {
  assert.equal(rankAtMarks(125, bands).rank, 1);
  assert.equal(rankAtMarks(110, bands).rank, 500);
  assert.equal(rankAtMarks(100, bands).rank, 1500);
  assert.equal(rankAtMarks(0, bands).rank, 120000);
});

test("smooth (linear) calculation inside a band", () => {
  // 95 marks is halfway through 90–100 → halfway between 4000 and 1500
  assert.equal(rankAtMarks(95, bands).rank, 2750);
  // 72.5 marks is a quarter through 70–80 → 15000 - 0.25 × 7000
  assert.equal(rankAtMarks(72.5, bands).rank, 13250);
});

test("more marks always means a better (smaller) rank", () => {
  let previous = Infinity;
  for (let m = 0; m <= 125; m += 0.5) {
    const r = rankAtMarks(m, bands).rank;
    assert.ok(r <= previous, `rank went up at ${m} marks`);
    previous = r;
  }
});

test("predicted range for 95 marks (±2 marks)", () => {
  const p = predictFromMarks(95, bands);
  // 97 marks → 2250, 93 marks → 3250, rounded to nice numbers
  assert.deepEqual(
    { min: p.minRank, max: p.maxRank, rank: p.rank, coverage: p.coverage },
    { min: 2250, max: 3250, rank: 2750, coverage: "ok" },
  );
});

test("top and bottom of the scale stay sensible", () => {
  const top = predictFromMarks(125, bands);
  assert.equal(top.minRank, 1);
  assert.ok(top.maxRank <= 100, `top max rank ${top.maxRank}`);
  const bottom = predictFromMarks(0, bands);
  assert.equal(bottom.maxRank, 120000);
});

test("marks outside 0–125 are clamped; no data returns null", () => {
  assert.equal(predictFromMarks(200, bands).marks, 125);
  assert.equal(predictFromMarks(-5, bands).marks, 0);
  assert.equal(predictFromMarks(90, []), null);
  assert.equal(predictFromMarks(Number.NaN, bands), null);
});

test("marks outside the data's range are flagged", () => {
  const partial = [{ min_marks: 50, max_marks: 100, min_rank: 1000, max_rank: 40000 }];
  assert.equal(predictFromMarks(110, partial).coverage, "above");
  assert.equal(predictFromMarks(20, partial).coverage, "below");
});

test("gaps between bands are bridged smoothly", () => {
  const gappy = [
    { min_marks: 0, max_marks: 40, min_rank: 60000, max_rank: 100000 },
    { min_marks: 60, max_marks: 125, min_rank: 1, max_rank: 20000 },
  ];
  // 50 marks is halfway across the 40→60 gap: halfway between 60000 and 20000
  assert.equal(rankAtMarks(50, gappy).rank, 40000);
});

test("entering a rank directly", () => {
  assert.deepEqual(predictFromRank(4321), { source: "rank", marks: null, rank: 4321, minRank: 4321, maxRank: 4321, coverage: "ok" });
  assert.equal(predictFromRank(0), null);
});

test("chance labels", () => {
  assert.equal(chanceFor({ minRank: 1000, maxRank: 1200 }, 1500), "high"); // worst 1200 ≤ 1350
  assert.equal(chanceFor({ minRank: 1400, maxRank: 1600 }, 1500), "moderate"); // borderline
  assert.equal(chanceFor({ minRank: 1600, maxRank: 1700 }, 1500), "moderate"); // within 10%
  assert.equal(chanceFor({ minRank: 1700, maxRank: 1900 }, 1500), "low");
});

const cutoffs = [
  { campus: "VIT Vellore", branch: "CSE (Core)", fee_category: 1, counselling_phase: 1, closing_rank: 1500 },
  { campus: "VIT Vellore", branch: "CSE (Core)", fee_category: 3, counselling_phase: 1, closing_rank: 3750 },
  { campus: "VIT Chennai", branch: "ECE", fee_category: 1, counselling_phase: 1, closing_rank: 9600 },
  { campus: "VIT-AP", branch: "Mechanical", fee_category: 2, counselling_phase: 1, closing_rank: 96000 },
];

test("college list: best chances first, filters work", () => {
  const p = predictFromMarks(95, bands); // 2250–3250
  const list = matchColleges(p, cutoffs);
  assert.deepEqual(list.map((c) => c.chance), ["high", "high", "high", "low"]);
  assert.equal(list[0].closing_rank, 3750); // most competitive High option first
  assert.equal(list.at(-1).campus, "VIT Vellore"); // Vellore CSE cat 1 is Low for this rank
  assert.equal(matchColleges(p, cutoffs, { campus: "VIT-AP" }).length, 1);
  assert.equal(matchColleges(p, cutoffs, { feeCategory: 1 }).length, 2);
});

test("preview shows up to 3 different campus+branch options", () => {
  const preview = previewMatches(predictFromRank(5000), cutoffs);
  assert.ok(preview.length <= 3);
  assert.equal(new Set(preview.map((c) => c.campus + c.branch)).size, preview.length);
});

test("gauge percentile", () => {
  assert.equal(percentileFor(1, bands), 100);
  assert.equal(percentileFor(60001, bands), 50);
  assert.equal(percentileFor(120000, bands), 0);
});
