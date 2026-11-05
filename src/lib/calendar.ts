// "Add to Google Calendar" link for a counselling session (times are India time)
import { siteConfig } from "@/config/site";

const gcalTime = (d: string, t: string) => `${d.replace(/-/g, "")}T${t.slice(0, 8).replace(/:/g, "")}`;

export function googleCalendarUrl(slot: { date: string; start_time: string; end_time: string }, bookingId: string, invoiceNumber?: string | null) {
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `EDUVORA counselling with ${siteConfig.founder.name}`,
    dates: `${gcalTime(slot.date, slot.start_time)}/${gcalTime(slot.date, slot.end_time)}`,
    ctz: "Asia/Kolkata",
    details: `One-to-one VITEEE counselling session.\nBooking ID: ${bookingId.slice(0, 8).toUpperCase()}${invoiceNumber ? `\nInvoice: ${invoiceNumber}` : ""}\n${siteConfig.siteUrl}/dashboard/bookings`,
  }).toString()}`;
}

/** Slot start as a real moment in time ("2026-11-10" + "10:00:00" in India) */
export const slotStart = (date: string, start: string) => new Date(`${date}T${start.slice(0, 8)}+05:30`);
