// Day-wise study plan (supabase/study-plans.sql) — shared by admin, student view and PDF.

export type PlanDay = {
  id: string;
  product_id: string;
  day_number: number;
  subjects: string[];
  topics: string[];
  file_ids: string[];
  note: string | null;
  is_sample: boolean;
};

export const PLAN_DAY_COLUMNS = "id,product_id,day_number,subjects,topics,file_ids,note,is_sample";

/** The sample CSV (Admin → Study plan → "Download sample CSV"). Lists inside a cell: separated by ; */
export const SAMPLE_CSV = `day,subjects,topics,pdfs,note
1,Physics,Topic one;Topic two,Exact PDF title as in Files,Short note for the day
2,Chemistry;Mathematics,Topic A;Topic B,"First PDF title;Second PDF title","A note, with a comma, in quotes"
`;

/** Minimal CSV reader: commas, "quoted, cells", "" inside quotes, \r\n or \n. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export const splitList = (s: string, max = 20) => s.split(";").map((x) => x.trim()).filter(Boolean).slice(0, max);

/** Which day of the plan "today" is for a student who started on `start` (YYYY-MM-DD, India time) */
export function todayDayNumber(start: string, today: string) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) + 1 : 1;
}

/** YYYY-MM-DD + n days */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
