// Small CSV reader shared by the admin bulk uploads.
// Handles quotes, commas and line breaks inside quotes, and Excel's hidden BOM character.

export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) out.push(row);
  return out;
}

/** Reads a CSV into objects using the header row (lower-cased) as keys. Throws if columns are missing. */
export function csvToObjects(text: string, required: string[]): Record<string, string>[] {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("The file needs a header row plus at least one data row.");
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}. Download the sample CSV to see the format.`);
  return table.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}
