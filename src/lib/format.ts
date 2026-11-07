export function formatPrice(amount: number) {
  return amount === 0 ? "Free" : "₹" + amount.toLocaleString("en-IN");
}

export function discountPercent(price: number, original?: number | null) {
  return original && original > price ? Math.round(((original - price) / original) * 100) : 0;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Today's date in India as "YYYY-MM-DD" */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** "2026-11-10" → "Tue, 10 Nov" */
export function formatDate(isoDate: string, withYear = false) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "18:30:00" → "6:30 PM" */
export function formatTime(time: string) {
  const [h, min] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${suffix}`;
}

// ---------------------------------------------------------------------
//  ALL timestamps are shown in Indian Standard Time (Asia/Kolkata),
//  whatever time zone the server or the visitor's computer is in.
// ---------------------------------------------------------------------
export const IST = "Asia/Kolkata";

/** "2026-11-10T08:30:00Z" → "10 Nov 2026, 2:00 pm IST" */
export function formatDateTime(iso: string | Date) {
  const d = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST }).format(new Date(iso));
  return `${d} IST`;
}

/** "2026-11-10T08:30:00Z" → "10 Nov 2026" (India date) */
export function formatDayIST(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST }).format(new Date(iso));
}

/** For CSV files: "2026-11-10 14:00 IST" */
export function csvDateTimeIST(iso: string | Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} IST`;
}

/** Current year in India (for invoice numbers) */
export function yearInIndia() {
  return Number(new Intl.DateTimeFormat("en-CA", { year: "numeric", timeZone: IST }).format(new Date()));
}

/** 754 → "12 min 34 s", 45 → "45 s", 3720 → "1 h 2 min" */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const t = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  if (h) return `${h} h${m ? ` ${m} min` : ""}`;
  if (m) return `${m} min${sec ? ` ${sec} s` : ""}`;
  return `${sec} s`;
}
