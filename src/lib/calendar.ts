// "Add to Google Calendar" link for a counselling voice call (times are India time)
import { siteConfig } from "@/config/site";
import { formatPhoneIN } from "./format";

const gcalTime = (d: string, t: string) => `${d.replace(/-/g, "")}T${t.slice(0, 8).replace(/:/g, "")}`;

export function googleCalendarUrl(slot: { date: string; start_time: string; end_time: string }, bookingId: string, invoiceNumber?: string | null, phone?: string | null) {
  const founderFirst = siteConfig.founder.name.split(" ")[0];
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `Voice call – ${siteConfig.businessName} counselling (30 min)`,
    dates: `${gcalTime(slot.date, slot.start_time)}/${gcalTime(slot.date, slot.end_time)}`,
    ctz: "Asia/Kolkata",
    details: [
      `30-minute one-to-one VITEEE counselling voice call with ${siteConfig.founder.name}.`,
      phone ? `${founderFirst} Sir will call you on ${formatPhoneIN(phone)}. Please keep your phone available.` : `${founderFirst} Sir will call you on the number you gave when booking.`,
      `Booking ID: ${bookingId.slice(0, 8).toUpperCase()}${invoiceNumber ? `\nInvoice: ${invoiceNumber}` : ""}`,
      `${siteConfig.siteUrl}/dashboard/bookings`,
    ].join("\n"),
  }).toString()}`;
}

/** Slot start as a real moment in time ("2026-11-10" + "10:00:00" in India) */
export const slotStart = (date: string, start: string) => new Date(`${date}T${start.slice(0, 8)}+05:30`);
