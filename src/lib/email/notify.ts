// =====================================================================
//  EMAILS — what we send, and when (SERVER ONLY)
//
//  To students:  payment_success · booking_confirmed · reminder_24h ·
//                reminder_1h · booking_cancelled · booking_rescheduled · welcome
//  To admin:     admin_payment · admin_booking · admin_enquiry
//
//  Each email is built fresh from the database (so "Resend" in the admin
//  page always sends correct, current details). "Send once" markers in the
//  database stop duplicates when a payment is reported more than once.
// =====================================================================
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { googleCalendarUrl, slotStart } from "../calendar";
import { communityHref, getCommunityLink } from "../community";
import { fullContactForPaidStudent } from "../contact";
import { formatDate, formatDateTime, formatPrice, formatTime } from "../format";
import { buildInvoicePdf, getInvoiceData, invoiceFileName } from "../invoices";
import { getAdminSupabase } from "../supabase/admin";
import { button, details, esc, layout, note, url } from "./layout";
import { adminEmail, inBackground, sendAndLog, type Email } from "./send";

const founder = siteConfig.founder.name;
const founderFirst = founder.split(" ")[0];
type Booking = {
  id: string; user_id: string; name: string; phone: string; email: string | null; message: string | null; class_year: string | null;
  expected_marks: number | null; status: string; payment_status: string; amount: number | null; invoice_number: string | null; paid_at: string | null;
  slots: { date: string; start_time: string; end_time: string; price: number } | null;
};

async function loadBooking(db: SupabaseClient, id: string) {
  const { data } = await db
    .from("bookings")
    .select("id,user_id,name,phone,email,message,class_year,expected_marks,status,payment_status,amount,invoice_number,paid_at,slots(date,start_time,end_time,price)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const b = data as unknown as Booking;
  if (!b.email) {
    const { data: p } = await db.from("profiles").select("email").eq("id", b.user_id).maybeSingle();
    b.email = (p?.email as string | null) ?? null;
  }
  return b;
}
const slotLine = (b: Booking) => (b.slots ? `${formatDate(b.slots.date, true)}, ${formatTime(b.slots.start_time)} – ${formatTime(b.slots.end_time)} IST` : "—");
const bookingRef = (id: string) => id.slice(0, 8).toUpperCase();

async function invoiceAttachment(db: SupabaseClient, id: string) {
  const inv = await getInvoiceData(db, id);
  if (!inv) return { inv: null, attachments: [] };
  return { inv, attachments: [{ filename: invoiceFileName(inv), content: await buildInvoicePdf(inv) }] };
}

// ---------------------------------------------------------------------
//  BUILDERS (kind + id → email)
// ---------------------------------------------------------------------
// Counselling package bought → sessions + "Book your first session"
async function packageEmail(db: SupabaseClient, id: string, inv: NonNullable<Awaited<ReturnType<typeof getInvoiceData>>>, attachments: Email["attachments"]): Promise<Email> {
  const { data: s } = await db.from("purchases").select("sessions_granted,sessions_unlimited").eq("id", id).maybeSingle();
  const sessions = s?.sessions_unlimited ? "Unlimited sessions until admission" : s?.sessions_granted ? `${s.sessions_granted} counselling session${s.sessions_granted === 1 ? "" : "s"}` : "Counselling sessions";
  return {
    to: inv.email!,
    subject: `Your ${inv.item} package is active ✅`,
    attachments,
    html: layout({
      preheader: `We received ${formatPrice(inv.amount)}. ${sessions} — book your first session now.`,
      title: `Welcome to the ${esc(inv.item)} package 🎉`,
      body: `<p>Hi ${esc(inv.name.split(" ")[0])},</p>
<p>Thank you! Your payment was received and your <strong>${esc(inv.item)}</strong> counselling package is now active.</p>
${details([["Package", inv.item], ["Includes", sessions], ["Amount paid", formatPrice(inv.amount)], ["Invoice number", inv.invoiceNumber], ["Payment method", inv.method], ["Date", formatDateTime(inv.date)]])}
<p>${button("Book Your First Session", url("/book-a-slot"))}${button("Rank & College Predictor", url("/dashboard/predictor"), "navy")}</p>
${note(`🎯 <strong>Unlocked with your package:</strong> the full Rank &amp; College Predictor and ${esc(founderFirst)} Sir's direct number (on your dashboard).`, "navy")}
<p style="font-size:13px;color:#64748b">Book each session from the Book a Slot page — it uses one credit, no payment needed. Your invoice (PDF) is attached.</p>`,
    }),
  };
}

export const builders: Record<string, (db: SupabaseClient, id: string) => Promise<Email | null>> = {
  // ---------- student: payment successful (course / material / papers / tests) ----------
  async payment_success(db, id) {
    const { inv, attachments } = await invoiceAttachment(db, id);
    if (!inv || inv.kind !== "purchase" || !inv.email) return null;
    const { data: pr } = await db.from("purchases").select("products(category)").eq("id", id).maybeSingle();
    if ((pr?.products as unknown as { category?: string } | null)?.category === "counselling_package") return packageEmail(db, id, inv, attachments);
    return {
      to: inv.email,
      subject: `Payment successful — ${inv.item}`,
      attachments,
      html: layout({
        preheader: `We received ${formatPrice(inv.amount)} for ${inv.item}. Your invoice is attached.`,
        title: `Payment successful 🎉`,
        body: `<p>Hi ${esc(inv.name.split(" ")[0])},</p>
<p>Thank you! Your payment was received and <strong>${esc(inv.item)}</strong> is now unlocked in your dashboard.</p>
${details([["Item", inv.item], ["Amount paid", formatPrice(inv.amount)], ["Invoice number", inv.invoiceNumber], ["Payment method", inv.method], ["Date", formatDateTime(inv.date)]])}
<p>${button("Go to Dashboard", url("/dashboard/courses"))}</p>
<p style="font-size:13px;color:#64748b">Your invoice (PDF) is attached to this email. You can also download it any time from <a href="${url("/dashboard/payments")}">Payment History</a>.</p>`,
      }),
    };
  },

  // ---------- student: counselling booking confirmed ----------
  async booking_confirmed(db, id) {
    const b = await loadBooking(db, id);
    if (!b || !b.email || !["confirmed", "pending", "completed"].includes(b.status)) return null;
    const paid = b.payment_status === "paid";
    const { attachments } = paid ? await invoiceAttachment(db, id) : { attachments: [] };
    const phone = paid ? fullContactForPaidStudent() : null;
    const gcal = b.slots ? googleCalendarUrl(b.slots, b.id, b.invoice_number) : null;
    const rows: [string, string][] = [
      ["Date & time", slotLine(b)],
      ["Booking ID", bookingRef(b.id)],
      ["Amount paid", paid && b.amount === 0 && !b.invoice_number ? "1 session credit (package)" : paid ? formatPrice(b.amount ?? b.slots?.price ?? 0) : "Free"],
      ...(b.invoice_number ? ([["Invoice number", b.invoice_number]] as [string, string][]) : []),
    ];
    return {
      to: b.email,
      subject: `Booking confirmed ✅ Counselling with ${founderFirst} Sir — ${b.slots ? formatDate(b.slots.date) : ""}`,
      attachments,
      html: layout({
        preheader: `Your counselling session is booked for ${slotLine(b)}.`,
        title: `Congratulations, ${b.name.split(" ")[0]}! 🎉`,
        body: `<p>Your one-to-one counselling session with <strong>${esc(founder)}</strong> is booked.</p>
${details(rows)}
${gcal ? `<p>${button("Add to Google Calendar", gcal)}${button("My Bookings", url("/dashboard/bookings"), "navy")}</p>` : ""}
${
  phone
    ? note(`<strong>${esc(founderFirst)} Sir's direct number:</strong> <a href="${phone.tel}" style="color:#0b2a5b;font-weight:bold">${esc(phone.display)}</a><br>
<a href="${phone.whatsapp}?text=${encodeURIComponent(`Hi ${founderFirst} Sir, I have booked a counselling session (Booking ID ${bookingRef(b.id)}).`)}" style="color:#047857;font-weight:bold">Chat on WhatsApp →</a>`, "green")
    : ""
}
${paid ? note(`🎯 <strong>Your full college list is now unlocked!</strong><br>The Rank &amp; College Predictor now shows every VIT campus &amp; branch you can get, with your chances, before the session.<br><br>${button("See My Colleges", url("/dashboard/predictor"))}`, "navy") : ""}
<p style="font-size:13px;color:#64748b">${attachments.length ? "Your invoice (PDF) is attached. " : ""}Need to change the time? Just reply to this email or message us on WhatsApp.</p>`,
      }),
    };
  },

  // ---------- student: reminders ----------
  async reminder_24h(db, id) {
    return reminder(db, id, "24h");
  },
  async reminder_1h(db, id) {
    return reminder(db, id, "1h");
  },

  // ---------- student: cancelled / rescheduled by admin ----------
  async booking_cancelled(db, id) {
    const b = await loadBooking(db, id);
    if (!b || !b.email) return null;
    return {
      to: b.email,
      subject: `Your counselling session on ${b.slots ? formatDate(b.slots.date) : ""} was cancelled`,
      html: layout({
        preheader: "Your counselling booking has been cancelled.",
        title: "Your session was cancelled",
        body: `<p>Hi ${esc(b.name.split(" ")[0])},</p>
<p>Your counselling session has been cancelled by our team.</p>
${details([["Was booked for", slotLine(b)], ["Booking ID", bookingRef(b.id)], ["Payment", b.payment_status === "refunded" ? "Refunded" : b.payment_status === "paid" ? "Paid — our team will contact you about a refund or a new time" : "—"]])}
<p>${button("Book a new time", url("/book-a-slot"))}</p>
<p style="font-size:13px;color:#64748b">Questions? Just reply to this email.</p>`,
      }),
    };
  },
  async booking_rescheduled(db, id) {
    const b = await loadBooking(db, id);
    if (!b || !b.email) return null;
    const gcal = b.slots ? googleCalendarUrl(b.slots, b.id, b.invoice_number) : null;
    return {
      to: b.email,
      subject: `New time for your counselling session — ${b.slots ? formatDate(b.slots.date) : ""}`,
      html: layout({
        preheader: `Your session is now on ${slotLine(b)}.`,
        title: "Your session has a new time",
        body: `<p>Hi ${esc(b.name.split(" ")[0])},</p>
<p>Your counselling session with <strong>${esc(founder)}</strong> has been moved to a new time:</p>
${details([["New date & time", slotLine(b)], ["Booking ID", bookingRef(b.id)]])}
<p>${gcal ? button("Add new time to Google Calendar", gcal) : ""}${button("My Bookings", url("/dashboard/bookings"), "navy")}</p>`,
      }),
    };
  },

  // ---------- student: welcome ----------
  async welcome(db, userId) {
    const { data: p } = await db.from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
    if (!p?.email) return null;
    return {
      to: p.email as string,
      subject: `Welcome to ${siteConfig.businessName}! 🎓`,
      html: layout({
        preheader: "Your account is ready — here's how to get started.",
        title: `Welcome, ${esc(String(p.full_name || "").split(" ")[0] || "there")}! 🎓`,
        body: `<p>Your ${esc(siteConfig.businessName)} account is ready. Here's what you can do:</p>
<ul style="padding-left:20px;margin:12px 0">
<li>📞 <strong>Book a one-to-one counselling session</strong> with ${esc(founder)}</li>
<li>🎯 Try the free <strong>Rank Predictor</strong> — your full college list unlocks with counselling</li>
<li>📚 Crash courses, study material, previous year papers and mock tests</li>
</ul>
<p>${button("Book Counselling", url("/book-a-slot"))}${button("Open Dashboard", url("/dashboard"), "navy")}</p>
${(await getCommunityLink()) ? `<p>${button("Join our WhatsApp community", url(communityHref("email")), "green")}</p><p style="font-size:13px;color:#64748b">Free VITEEE updates — important dates, results and counselling news.</p>` : ""}`,
      }),
    };
  },

  // ---------- admin: new payment ----------
  async admin_payment(db, id) {
    const to = adminEmail();
    const inv = await getInvoiceData(db, id);
    if (!to || !inv) return null;
    return {
      to,
      subject: `💰 New payment: ${formatPrice(inv.amount)} — ${inv.item}`,
      html: layout({
        preheader: `${inv.name} paid ${formatPrice(inv.amount)}.`,
        title: "New payment received",
        body: `${details([["Student", inv.name], ["Phone", inv.phone || "—"], ["Email", inv.email || "—"], ["Item", inv.item], ["Amount", formatPrice(inv.amount)], ["Method", inv.method], ["Invoice", inv.invoiceNumber], ["Paid", formatDateTime(inv.date)]])}
<p>${button("Open Admin → Payments", url("/admin/payments"), "navy")}</p>`,
      }),
    };
  },

  // ---------- admin: new counselling booking ----------
  async admin_booking(db, id) {
    const to = adminEmail();
    const b = await loadBooking(db, id);
    if (!to || !b) return null;
    return {
      to,
      subject: `📅 New counselling booking: ${b.name} — ${slotLine(b)}`,
      html: layout({
        preheader: `${b.name} booked ${slotLine(b)}.`,
        title: "New counselling booking",
        body: `${details([
          ["Student", b.name],
          ["Phone", b.phone],
          ["Email", b.email || "—"],
          ["Class / year", b.class_year || "—"],
          ["Expected marks", b.expected_marks !== null ? `${+b.expected_marks} / 125` : "—"],
          ["Slot", slotLine(b)],
          ["Amount", b.payment_status === "paid" ? formatPrice(b.amount ?? 0) : "Free"],
          ["Booking ID", bookingRef(b.id)],
        ])}
${b.message ? note(`<strong>Message:</strong><br>${esc(b.message)}`) : ""}
<p>${button("Open Admin → Bookings", url("/admin/bookings"), "navy")}</p>`,
      }),
    };
  },

  // ---------- admin: new enquiry ----------
  async admin_enquiry(db, id) {
    const to = adminEmail();
    const { data: e } = await db.from("enquiries").select("name,phone,email,class_year,message,source,created_at").eq("id", id).maybeSingle();
    if (!to || !e) return null;
    return {
      to,
      subject: `✉️ New enquiry from ${e.name}`,
      html: layout({
        preheader: `${e.name} (${e.phone}) sent an enquiry.`,
        title: "New enquiry",
        body: `${details([["Name", e.name], ["Phone", e.phone], ["Email", e.email || "—"], ["Class / year", e.class_year || "—"], ["From", e.source === "unlock" ? "Unlock page" : "Contact page"], ["Received", formatDateTime(e.created_at)]])}
${e.message ? note(`<strong>Message:</strong><br>${esc(e.message)}`) : ""}
<p>${button("Open Admin → Enquiries", url("/admin/enquiries"), "navy")}</p>`,
      }),
    };
  },
};

async function reminder(db: SupabaseClient, id: string, which: "24h" | "1h"): Promise<Email | null> {
  const b = await loadBooking(db, id);
  if (!b || !b.email || !b.slots || !["confirmed"].includes(b.status)) return null;
  const phone = b.payment_status === "paid" ? fullContactForPaidStudent() : null;
  return {
    to: b.email,
    subject: which === "24h" ? `Reminder: your counselling session is tomorrow — ${formatTime(b.slots.start_time)} IST` : `Starting in 1 hour: your counselling session at ${formatTime(b.slots.start_time)} IST`,
    html: layout({
      preheader: `Your session with ${founder} is on ${slotLine(b)}.`,
      title: which === "24h" ? "Your session is tomorrow ⏰" : "Your session starts in 1 hour ⏰",
      body: `<p>Hi ${esc(b.name.split(" ")[0])}, a quick reminder about your counselling session with <strong>${esc(founder)}</strong>:</p>
${details([["Date & time", slotLine(b)], ["Booking ID", bookingRef(b.id)]])}
${note("Keep your VITEEE marks / rank, preferred campuses and questions ready. Parents are welcome to join.")}
${phone ? `<p>${button("Call " + founderFirst + " Sir", phone.tel, "navy")}${button("WhatsApp", phone.whatsapp, "green")}</p>` : ""}
<p>${button("Add to Google Calendar", googleCalendarUrl(b.slots, b.id, b.invoice_number))}</p>`,
    }),
  };
}

// ---------------------------------------------------------------------
//  SENDING (build → send → log). Never throws.
// ---------------------------------------------------------------------
export async function sendKind(kind: string, id: string, logId?: string): Promise<boolean> {
  const db = getAdminSupabase();
  const build = builders[kind];
  if (!db || !build) return false;
  let mail: Email | null = null;
  try {
    mail = await build(db, id);
  } catch (e) {
    console.warn(`[email] could not build ${kind}:`, (e as Error).message);
  }
  if (!mail) return false;
  return sendAndLog(kind, id, mail, logId);
}

/** Set a "sent" marker only if it is still empty → true = we may send (once). */
async function claim(db: SupabaseClient, table: "purchases" | "bookings" | "profiles", column: string, id: string) {
  const { data, error } = await db.from(table).update({ [column]: new Date().toISOString() }).eq("id", id).is(column, null).select("id");
  if (error) {
    console.warn(`[email] ${table}.${column} missing — run supabase/emails-invoices.sql. Email skipped.`);
    return false;
  }
  return (data ?? []).length > 0;
}

/** After a product payment is verified (called from every place that marks paid). */
export function notifyPurchasePaid(purchaseId: string) {
  inBackground(async () => {
    const db = getAdminSupabase();
    if (!db) return;
    const { data: p } = await db.from("purchases").select("status,amount").eq("id", purchaseId).maybeSingle();
    if (!p || p.status !== "paid" || Number(p.amount) <= 0) return;
    if (!(await claim(db, "purchases", "receipt_email_sent_at", purchaseId))) return;
    await sendKind("payment_success", purchaseId);
    await sendKind("admin_payment", purchaseId);
  });
}

/** After a counselling booking is confirmed (paid, or a free slot). */
export function notifyBookingConfirmed(bookingId: string) {
  inBackground(async () => {
    const db = getAdminSupabase();
    if (!db) return;
    if (!(await claim(db, "bookings", "confirmation_email_sent_at", bookingId))) return;
    await sendKind("booking_confirmed", bookingId);
    await sendKind("admin_booking", bookingId);
    const { data: b } = await db.from("bookings").select("payment_status").eq("id", bookingId).maybeSingle();
    if (b?.payment_status === "paid") await sendKind("admin_payment", bookingId);
  });
}

export function notifyBookingChanged(bookingId: string, change: "cancelled" | "rescheduled") {
  inBackground(() => sendKind(change === "cancelled" ? "booking_cancelled" : "booking_rescheduled", bookingId));
}

export function notifyEnquiry(enquiryId: string) {
  inBackground(() => sendKind("admin_enquiry", enquiryId));
}

/** Welcome email — once per student (existing students were marked as already welcomed). */
export function welcomeIfNew(userId: string) {
  inBackground(async () => {
    const db = getAdminSupabase();
    if (!db) return;
    if (!(await claim(db, "profiles", "welcome_email_sent_at", userId))) return;
    await sendKind("welcome", userId);
  });
}

// ---------------------------------------------------------------------
//  REMINDERS — 24 hours and 1 hour before each confirmed session.
//  Run by /api/cron/reminders (every 15 min once online) and also whenever
//  the admin dashboard is opened.
// ---------------------------------------------------------------------
export async function sendDueReminders(): Promise<{ r24: number; r1: number }> {
  const db = getAdminSupabase();
  const out = { r24: 0, r1: 0 };
  if (!db) return out;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const in2days = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + 2 * 86400000));
  const { data, error } = await db
    .from("bookings")
    .select("id,paid_at,created_at,reminder_24h_sent_at,reminder_1h_sent_at,slots!inner(date,start_time)")
    .eq("status", "confirmed")
    .is("reminder_1h_sent_at", null)
    .gte("slots.date", today)
    .lte("slots.date", in2days)
    .limit(200);
  if (error) {
    console.warn("[email] reminders skipped (run supabase/emails-invoices.sql?):", error.message);
    return out;
  }
  const now = Date.now();
  for (const b of (data ?? []) as unknown as { id: string; paid_at: string | null; created_at: string; reminder_24h_sent_at: string | null; slots: { date: string; start_time: string } }[]) {
    const minutesLeft = (slotStart(b.slots.date, b.slots.start_time).getTime() - now) / 60000;
    const bookedAt = new Date(b.paid_at ?? b.created_at).getTime();
    if (minutesLeft > 0 && minutesLeft <= 75) {
      if (await claim(db, "bookings", "reminder_1h_sent_at", b.id)) {
        await sendKind("reminder_1h", b.id);
        out.r1++;
      }
    } else if (minutesLeft > 75 && minutesLeft <= 24 * 60 + 15 && !b.reminder_24h_sent_at && now - bookedAt > 60 * 60000) {
      // (skip the 24h reminder for bookings made in the last hour — they just got the confirmation)
      if (await claim(db, "bookings", "reminder_24h_sent_at", b.id)) {
        await sendKind("reminder_24h", b.id);
        out.r24++;
      }
    }
  }
  return out;
}
