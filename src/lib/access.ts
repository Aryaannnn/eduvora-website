// Access period per product (supabase/access-periods.sql). The product's setting
// is stored in products.details.access; each purchase has its own access_until.

export type ProductAccess = { kind: "lifetime" | "days" | "until"; days?: number; until?: string; renewals?: boolean };

/** The product's setting (missing / broken = lifetime). */
export function productAccess(details: unknown): ProductAccess {
  const a = (details && typeof details === "object" ? (details as { access?: unknown }).access : null) as Partial<ProductAccess> | null;
  if (a?.kind === "days" && Number(a.days) > 0) return { kind: "days", days: Math.floor(Number(a.days)), renewals: !!a.renewals };
  if (a?.kind === "until" && /^\d{4}-\d{2}-\d{2}$/.test(String(a.until ?? ""))) return { kind: "until", until: a.until, renewals: !!a.renewals };
  return { kind: "lifetime", renewals: !!a?.renewals };
}

const longDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00+05:30` : d) : d);

/** 365 → "1 year", 730 → "2 years", 180 → "180 days" */
function daysText(n: number) {
  if (n % 365 === 0) return `${n / 365} year${n === 365 ? "" : "s"}`;
  if (n === 30) return "1 month";
  return `${n} days`;
}

/** Card / course page / checkout: "Lifetime access", "Access: 1 year from enrolment", "Access until 31 Aug 2027" */
export function accessLabel(a: ProductAccess) {
  if (a.kind === "days") return `Access: ${daysText(a.days!)} from enrolment`;
  if (a.kind === "until") return `Access until ${longDate(a.until!)}`;
  return "Lifetime access";
}

/** A student's purchase: "Access until 31 Aug 2027" / "Lifetime access" */
export const purchaseAccessText = (accessUntil: string | null | undefined) => (accessUntil ? `Access until ${longDate(accessUntil)}` : "Lifetime access");

/** Has this purchase's access ended? (null = lifetime) */
export const accessEnded = (accessUntil: string | null | undefined) => !!accessUntil && new Date(accessUntil).getTime() <= Date.now();

/** Ends within the next `days` days (and not yet ended) */
export const accessEndsSoon = (accessUntil: string | null | undefined, days = 7) =>
  !!accessUntil && !accessEnded(accessUntil) && new Date(accessUntil).getTime() - Date.now() <= days * 86_400_000;
