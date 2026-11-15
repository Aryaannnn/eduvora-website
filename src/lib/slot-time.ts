// Counselling slots are always 30 minutes (India time). Small helpers shared by
// Admin → Slots, the booking page and the server.

export const SLOT_MINUTES = 30;

/** "10:00" → minutes since midnight (600) */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
/** 630 → "10:30" */
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** "10:00" → "10:30" (null if it would go past midnight) */
export function slotEnd(start: string): string | null {
  const end = toMinutes(start) + SLOT_MINUTES;
  return end <= 24 * 60 - 1 ? fromMinutes(end) : null;
}

/** Today's date and the current time in India, e.g. { date: "2026-11-15", minutes: 615 } */
export function nowInIndia(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Back-to-back 30-minute starts between dayStart and dayEnd, leaving out a break. */
export function dailyStarts(dayStart: string, dayEnd: string, breakStart?: string, breakEnd?: string): string[] {
  const out: string[] = [];
  const b0 = breakStart && breakEnd ? toMinutes(breakStart) : null;
  const b1 = breakStart && breakEnd ? toMinutes(breakEnd) : null;
  for (let t = toMinutes(dayStart); t + SLOT_MINUTES <= toMinutes(dayEnd); t += SLOT_MINUTES) {
    if (b0 !== null && b1 !== null && t < b1 && t + SLOT_MINUTES > b0) continue; // overlaps the break
    out.push(fromMinutes(t));
  }
  return out;
}

/** Slot start as a real moment (India time), e.g. for "starts too soon" checks. */
export const slotStartsAt = (date: string, start: string) => new Date(`${date}T${start.slice(0, 5)}:00+05:30`);

/** The first slot that can still be booked (starts later than now + notice minutes). */
export function firstBookable<T extends { date: string; start_time: string }>(slots: T[], noticeMinutes = 60, now = Date.now()): T | undefined {
  const cutoff = now + noticeMinutes * 60_000;
  return slots.find((s) => slotStartsAt(s.date, s.start_time).getTime() > cutoff);
}
