// Small, pure helpers for invoices (no database, no PDF) — easy to test.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–99 → "Ninety-Nine" */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}
/** 0–999 → "Four Hundred Ninety-Nine" */
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
}
/** Whole number in the Indian system (Thousand, Lakh, Crore). */
function indianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  n %= 1000;
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
}

/** 1499 → "Rupees One Thousand Four Hundred Ninety-Nine Only"; 10.5 → "Rupees Ten and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const paiseTotal = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  if (rupees === 0 && paise > 0) return `${twoDigits(paise)} Paise Only`;
  return `Rupees ${indianWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}

/** Indian GST state codes (first 2 digits of a GSTIN). */
const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** "33ABCDE1234F1Z5" → { code: "33", name: "Tamil Nadu" } (null if the GSTIN looks wrong) */
export function stateFromGstin(gstin: string): { code: string; name: string } | null {
  const g = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(g)) return null;
  const name = STATES[g.slice(0, 2)];
  return name ? { code: g.slice(0, 2), name } : null;
}

export type GstLine = { label: string; amount: number };
export type GstBreakup = { taxable: number; lines: GstLine[]; total: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GST inside a price that already INCLUDES tax (what the student paid).
 * Students' addresses aren't collected, so the place of supply is the
 * seller's state (GST law, section 12(2)(b) IGST Act) → CGST + SGST, half each.
 * The lines always add up exactly to the total.
 */
export function gstFromInclusive(total: number, ratePercent: number): GstBreakup {
  const taxable = r2(total / (1 + ratePercent / 100));
  const tax = r2(total - taxable);
  const cgst = r2(tax / 2);
  const sgst = r2(tax - cgst);
  const half = ratePercent / 2;
  return {
    taxable,
    lines: [
      { label: `CGST @ ${half}%`, amount: cgst },
      { label: `SGST @ ${half}%`, amount: sgst },
    ],
    total: r2(taxable + cgst + sgst),
  };
}
