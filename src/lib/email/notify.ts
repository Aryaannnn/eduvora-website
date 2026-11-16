// =====================================================================
//  EMAILS — what we send, and when (SERVER ONLY)
//
//  Counselling is a 30-minute VOICE CALL: Utkarsh Sir calls the student on
//  the number they gave when booking.
//  Our own number (calls + WhatsApp) follows Admin → Settings → Contact mode:
//  Open → in every email · Private → only in emails to students who have paid.
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
import { getContactMode } from "../contact-mode";
import { formatDate, formatDateTime, formatPhoneIN, formatPrice, formatTime } from "../format";
import { buildInvoicePdf, getInvoiceData, invoiceFileName } from "../invoices";
import { syncBookingCalendar } from "../google-calendar";
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

const BOOKING_COLS = "id,user_id,name,phone,email,message,class_year,expected_marks,status,payment_status,amount,invoice_number,paid_at,slots(date,start_time,end_time,price)";

async function loadBooking(db: SupabaseClient, id: string) {
  const { data } = await db.from("bookings").select(BOOKING_COLS).eq("id", id).maybeSingle();
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

/** "Utkarsh Sir will call you on +91 … on Tue, 10 Nov 2026 at 6:30 PM IST." */
const callSentence = (b: Booking) =>
  `${founderFirst} Sir will call you on <strong>${esc(formatPhoneIN(b.phone))}</strong>${b.slots ? ` on <strong>${esc(formatDate(b.slots.date, true))}</strong> at <strong>${esc(formatTime(b.slots.start_time))} IST</strong>` : ""}.`;
/** The voice call box in every booking email. */
const callBlock = (b: Booking) =>
  note(`📞 <strong>30-minute voice call</strong><br>${callSentence(b)}<br><span style="font-size:13px">Please keep your phone available at that time. Parents are welcome to join on speaker.</span>`, "green");
const gcalFor = (b: Booking) => (b.slots ? googleCalendarUrl(b.slots, b.id, b.invoice_number, b.phone) : null);
/**
 * The number (Call + WhatsApp) for THIS email, following Admin → Settings → Contact mode:
 * Open → everyone · Private → only students who have paid. null = don't show it.
 */
async function contactFor(paid: boolean) {
  const cm = await getContactMode();
  return { phone: paid || cm.mode === "open" ? fullContactForPaidStudent() : null, cm };
}
const waLink = (phone: { whatsapp: string }, text: string) => `${phone.whatsapp}?text=${encodeURIComponent(text)}`;

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
  const sessions = s?.sessions_unlimited ? "Unlimited 30-minute sessions until admission" : s?.sessions_granted ? `${s.sessions_granted} × 30-minute counselling session${s.sessions_granted === 1 ? "" : "s"}` : "Counselling sessions";
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
    const { phone, cm } = await contactFor(paid);
    const gcal = gcalFor(b);
    const rows: [string, string][] = [
      ["Date & time", slotLine(b)],
      ["Session", "30-minute one-to-one voice call"],
      ["We call you on", formatPhoneIN(b.phone)],
      ["Booking ID", bookingRef(b.id)],
      ["Amount paid", paid && b.amount === 0 && !b.invoice_number ? "1 session credit (package)" : paid ? formatPrice(b.amount ?? b.slots?.price ?? 0) : "Free"],
      ...(b.invoice_number ? ([["Invoice number", b.invoice_number]] as [string, string][]) : []),
    ];
    return {
      to: b.email,
      subject: `Booking confirmed ✅ Counselling with ${founderFirst} Sir — ${b.slots ? formatDate(b.slots.date) : ""}`,
      attachments,
      html: layout({
        preheader: `${founderFirst} Sir will call you on ${formatPhoneIN(b.phone)} on ${slotLine(b)}.`,
        title: `Congratulations, ${b.name.split(" ")[0]}! 🎉`,
        body: `<p>Your 30-minute one-to-one counselling voice call with <strong>${esc(founder)}</strong> is booked.</p>
${callBlock(b)}
${details(rows)}
<p>${gcal ? button("Add to Google Calendar", gcal) : ""}${button("My Bookings", url("/dashboard/bookings"), "navy")}</p>
${
  phone
    ? note(`<strong>${esc(founderFirst)} Sir's number (calls &amp; WhatsApp):</strong> <a href="${phone.tel}" style="color:#0b2a5b;font-weight:bold">${esc(phone.display)}</a><br>
<a href="${waLink(phone, `Hi ${founderFirst} Sir, I have booked a counselling session (Booking ID ${bookingRef(b.id)}).`)}" style="color:#047857;font-weight:bold">WhatsApp us →</a>${cm.mode === "open" ? `<br><span style="font-size:12px;color:#64748b">${esc(cm.openNote)}</span>` : ""}`, "navy")
    : ""
}
${paid ? note(`🎯 <strong>Your full college list is now unlocked!</strong><br>The Rank &amp; College Predictor now shows every VIT campus &amp; branch you can get, with your chances, before the session.<br><br>${button("See My Colleges", url("/dashboard/predictor"))}`, "navy") : ""}
<p style="font-size:13px;color:#64748b">${attachments.length ? "Your invoice (PDF) is attached. " : ""}Wrong number, or need to change the time? Just reply to this email${phone ? " or WhatsApp us" : ""}. ${esc(siteConfig.refunds.counsellingNote)} <a href="${url("/refund-policy")}">Refund &amp; Cancellation Policy</a></p>`,
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
    const gcal = gcalFor(b);
    return {
      to: b.email,
      subject: `New time for your counselling session — ${b.slots ? formatDate(b.slots.date) : ""}`,
      html: layout({
        preheader: `Your session is now on ${slotLine(b)}.`,
        title: "Your session has a new time",
        body: `<p>Hi ${esc(b.name.split(" ")[0])},</p>
<p>Your 30-minute counselling voice call with <strong>${esc(founder)}</strong> has been moved to a new time:</p>
${details([["New date & time", slotLine(b)], ["Booking ID", bookingRef(b.id)]])}
${callBlock(b)}
<p>${gcal ? button("Add new time to Google Calendar", gcal) : ""}${button("My Bookings", url("/dashboard/bookings"), "navy")}</p>`,
      }),
    };
  },

  // ---------- visitor: the free guide (popup) ----------
  async free_guide(db, id) {
    const { data: r } = await db.from("guide_requests").select("id,name,email,created_at,products(title)").eq("id", id).maybeSingle();
    if (!r?.email) return null;
    const title = (r.products as unknown as { title?: string } | null)?.title ?? "VITEEE Counselling Checklist";
    const first = String(r.name ?? "").split(" ")[0] || "there";
    return {
      to: r.email as string,
      subject: `Your free ${title} 📘`,
      html: layout({
        preheader: `Here is your free ${title}. Read it online any time in the next 30 days.`,
        title: "Your free guide is ready 📘",
        body: `<p>Hi ${esc(first)},</p>
<p>Thank you for your interest in EDUVORA! Here is your free <strong>${esc(title)}</strong>:</p>
<p>${button("Read the guide online", url(`/api/guide/${r.id}`))}</p>
<p style="font-size:13px;color:#64748b">The link works for 30 days.</p>
${note(`<strong>Want help with your own rank, campus or branch?</strong><br>Send us a free enquiry and our team will call you back — no payment needed.<br><br>${button("Book a free enquiry call", url("/contact#enquiry"), "navy")}`, "gold")}
<p style="font-size:12px;color:#94a3b8">You're getting this email because you asked for the free guide on our website. You won't get marketing emails unless you sign up.</p>`,
      }),
    };
  },

  // ---------- student: "You left something behind" (2 h and 24 h after an unfinished payment) ----------
  async checkout_reminder_2h(db, id) {
    return checkoutReminder(db, id, "2h");
  },
  async checkout_reminder_24h(db, id) {
    return checkoutReminder(db, id, "24h");
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
<li>📞 <strong>Book a 30-minute one-to-one counselling voice call</strong> with ${esc(founder)}</li>
<li>🎯 Try the free <strong>Rank Predictor</strong> — your full college list unlocks with counselling</li>
<li>📚 Crash courses, study material, previous year papers and mock tests</li>
</ul>
<p>${button("Book Counselling", url("/book-a-slot"))}${button("Open Dashboard", url("/dashboard"), "navy")}</p>
${await welcomeContact()}
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
          ["Call on", formatPhoneIN(b.phone)],
          ["Email", b.email || "—"],
          ["Class / year", b.class_year || "—"],
          ["Expected marks", b.expected_marks !== null ? `${+b.expected_marks} / 500` : "—"],
          ["Slot", slotLine(b)],
          ["Amount", b.payment_status === "paid" ? formatPrice(b.amount ?? 0) : "Free"],
          ["Booking ID", bookingRef(b.id)],
        ])}
${b.message ? note(`<strong>Message:</strong><br>${esc(b.message)}`) : ""}
<p>${button(`📞 Call ${b.name.split(" ")[0]}`, `tel:${b.phone.replace(/[^\d+]/g, "")}`, "green")}</p>
<p style="font-size:13px;color:#64748b">30-minute voice call — please call the student at the booked time. Mark it as called / no answer / completed in Admin → Bookings.</p>
<p>${button("Open Admin → Bookings", url("/admin/bookings"), "navy")}</p>`,
      }),
    };
  },

  // ---------- student: feedback 1 hour after the session ----------
  async feedback_request(db, id) {
    const b = await loadBooking(db, id);
    if (!b || !b.email || !b.slots || b.status !== "completed") return null;
    const { data: done } = await db.from("session_feedback").select("id").eq("booking_id", id).maybeSingle();
    if (done) return null; // already gave feedback in My Bookings
    const link = url(`/dashboard/feedback?booking=${b.id}`);
    const stars = [1, 2, 3, 4, 5]
      .map((n) => `<a href="${link}&amp;rating=${n}" style="font-size:30px;line-height:1;color:#f5b301;text-decoration:none;padding:0 3px" title="${n} star${n === 1 ? "" : "s"}">★</a>`)
      .join("");
    return {
      to: b.email,
      subject: `How was your counselling session with ${founderFirst} Sir? (1 minute)`,
      html: layout({
        preheader: "Tell us how it went — 1 minute, 3 questions.",
        title: `How was your session, ${esc(b.name.split(" ")[0])}?`,
        body: `<p>Thank you for your counselling session with <strong>${esc(founder)}</strong> on ${esc(slotLine(b))}.</p>
<p>Your feedback takes about 1 minute and helps us guide the next student better.</p>
<p style="text-align:center;margin:18px 0 6px">${stars}</p>
<p style="text-align:center;font-size:12px;color:#64748b;margin:0 0 16px">Tap a star to start</p>
<p style="text-align:center">${button("Give Feedback", link)}</p>
<p style="font-size:13px;color:#64748b">3 quick questions: your rating, what helped you most, and what we can improve. You can also find this form in <a href="${url("/dashboard/bookings")}">My Bookings</a>.</p>`,
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

/** Welcome email: Open → the number with WhatsApp · Private → the free enquiry form. */
async function welcomeContact() {
  const { phone, cm } = await contactFor(false);
  if (phone) {
    return note(`<strong>Questions?</strong> Call or WhatsApp us on <a href="${phone.tel}" style="color:#0b2a5b;font-weight:bold">${esc(phone.display)}</a> — <a href="${waLink(phone, siteConfig.whatsappMessage)}" style="color:#047857;font-weight:bold">WhatsApp us →</a><br><span style="font-size:12px;color:#64748b">${esc(cm.openNote)}</span>`, "green");
  }
  return `<p style="font-size:13px;color:#64748b">Questions? <a href="${url("/contact#enquiry")}">Send us a free enquiry</a> — ${esc(cm.privateNote.charAt(0).toLowerCase() + cm.privateNote.slice(1))}</p>`;
}

async function reminder(db: SupabaseClient, id: string, which: "24h" | "1h"): Promise<Email | null> {
  const b = await loadBooking(db, id);
  if (!b || !b.email || !b.slots || !["confirmed"].includes(b.status)) return null;
  const { phone } = await contactFor(b.payment_status === "paid");
  return {
    to: b.email,
    subject: which === "24h" ? `Reminder: ${founderFirst} Sir will call you tomorrow at ${formatTime(b.slots.start_time)} IST` : `In 1 hour: ${founderFirst} Sir will call you at ${formatTime(b.slots.start_time)} IST`,
    html: layout({
      preheader: `${founderFirst} Sir will call you on ${formatPhoneIN(b.phone)} on ${slotLine(b)}.`,
      title: which === "24h" ? "Your voice call is tomorrow ⏰" : "Your voice call is in 1 hour ⏰",
      body: `<p>Hi ${esc(b.name.split(" ")[0])}, a quick reminder about your 30-minute counselling voice call with <strong>${esc(founder)}</strong>:</p>
${callBlock(b)}
${details([["Date & time", slotLine(b)], ["Booking ID", bookingRef(b.id)]])}
${note("Keep your VITEEE marks / rank, preferred campuses and questions ready. Parents are welcome to join on speaker.")}
${phone ? `<p>${button("Call " + founderFirst + " Sir", phone.tel, "navy")}${button("WhatsApp", waLink(phone, `Hi ${founderFirst} Sir, about my counselling call on ${slotLine(b)} (Booking ID ${bookingRef(b.id)}).`), "green")}</p>` : ""}
<p>${button("Add to Google Calendar", googleCalendarUrl(b.slots, b.id, b.invoice_number, b.phone))}</p>
${which === "24h" ? `<p style="font-size:13px;color:#64748b">Can't make it? Reply to this email as soon as possible. ${esc(siteConfig.refunds.counsellingNote)}</p>` : ""}`,
    }),
  };
}

// Where to send someone back to finish buying (by product type)
const PRODUCT_PAGE: Record<string, (slug: string) => string> = {
  crash_course: (slug) => `/courses/${slug}`,
  study_material: () => "/study-material",
  previous_paper: () => "/previous-year-papers",
  mock_test: () => "/mock-tests",
  counselling_package: () => "/book-a-slot#packages",
};

/** One friendly reminder about an unfinished payment — only if they still haven't paid. */
async function checkoutReminder(db: SupabaseClient, id: string, which: "2h" | "24h"): Promise<Email | null> {
  let item = "", link = "", price = 0, email = "", name = "";
  const { data: pu } = await db.from("purchases").select("id,user_id,status,amount,product_id,products(title,slug,category,price)").eq("id", id).maybeSingle();
  if (pu) {
    if (pu.status === "paid" || pu.status === "refunded" || !pu.user_id) return null;
    const { count } = await db.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", pu.user_id).eq("product_id", pu.product_id).eq("status", "paid");
    if ((count ?? 0) > 0) return null; // bought it in the meantime
    const pr = pu.products as unknown as { title: string; slug: string; category: string; price: number } | null;
    if (!pr) return null;
    const { data: prof } = await db.from("profiles").select("full_name,email,role").eq("id", pu.user_id).maybeSingle();
    if (!prof?.email || prof.role === "admin" || prof.role === "counsellor") return null;
    item = pr.title;
    price = Number(pr.price ?? pu.amount ?? 0);
    link = (PRODUCT_PAGE[pr.category] ?? (() => "/"))(pr.slug);
    email = prof.email as string;
    name = String(prof.full_name ?? "");
  } else {
    const b = await loadBooking(db, id);
    if (!b || !b.user_id || b.payment_status === "paid" || !b.email) return null;
    const { count } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", b.user_id).eq("payment_status", "paid");
    if ((count ?? 0) > 0) return null; // booked a session in the meantime
    item = "30-minute counselling voice call";
    price = Number(b.amount ?? b.slots?.price ?? 0);
    link = "/book-a-slot";
    email = b.email;
    name = b.name;
  }
  const first = name.split(" ")[0] || "there";
  const later = which === "24h";
  const { phone: open } = await contactFor(false); // Open mode only — they haven't paid
  return {
    to: email,
    subject: later ? "You left something behind 👀" : `Still thinking about ${item}?`,
    html: layout({
      preheader: later ? `Your ${item} is still waiting for you.` : `You started a payment for ${item} but didn't finish. Need any help?`,
      title: later ? "You left something behind" : "Need a hand finishing up?",
      body: `<p>Hi ${esc(first)},</p>
<p>${later ? "Just a gentle reminder —" : "We noticed"} you started a payment for <strong>${esc(item)}</strong>${price > 0 ? ` (${esc(formatPrice(price))})` : ""} but it wasn't completed. No money was taken.</p>
<p>${button(link.startsWith("/book-a-slot") && !link.includes("#") ? "Pick a time again" : "Complete my purchase", url(link))}</p>
<p>Had a problem with the payment, or have a question first? Just reply to this email${open ? ` or ${button("WhatsApp us", waLink(open, `Hi, I had a question about ${item}.`), "green")}` : ` or ${button("Send us an enquiry", url("/contact#enquiry"), "navy")}`}</p>
<p style="font-size:12px;color:#94a3b8">${later ? "This is our last reminder about it — we won't email you about this again." : "You're getting this because you started a payment on our website."}</p>`,
    }),
  };
}

// ---------------------------------------------------------------------
//  "YOU LEFT SOMETHING BEHIND" — run by /api/cron/reminders (every 15 min).
//  Only when switched ON in Admin → Settings. For each unfinished payment
//  started after it was switched on: ONE email after 2 hours and ONE after
//  24 hours, newest attempt only per student + item, never if they paid,
//  never for payments older than 3 days.
// ---------------------------------------------------------------------
export async function sendCheckoutReminders(): Promise<{ r2h: number; r24h: number }> {
  const out = { r2h: 0, r24h: 0 };
  const db = getAdminSupabase();
  if (!db) return out;
  const { data: g } = await db.from("growth_settings").select("abandoned_reminders,abandoned_enabled_at").eq("id", 1).maybeSingle();
  if (!g?.abandoned_reminders || !g.abandoned_enabled_at) return out;
  const now = Date.now();
  const since = new Date(Math.max(new Date(g.abandoned_enabled_at as string).getTime(), now - 3 * 86_400_000)).toISOString();
  const twoHoursAgo = new Date(now - 2 * 3_600_000).toISOString();

  type Row = { id: string; user_id: string | null; created_at: string; nudge_2h_at: string | null; nudge_24h_at: string | null; key: string; table: "purchases" | "bookings" };
  const rows: Row[] = [];
  const pu = await db
    .from("purchases")
    .select("id,user_id,product_id,created_at,nudge_2h_at,nudge_24h_at,amount")
    .in("status", ["created", "pending", "failed", "abandoned"])
    .gt("amount", 0)
    .not("user_id", "is", null)
    .gte("created_at", since)
    .lte("created_at", twoHoursAgo)
    .is("nudge_24h_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (pu.error) {
    console.warn("[email] checkout reminders skipped (run supabase/lead-capture.sql?):", pu.error.message);
    return out;
  }
  for (const r of pu.data ?? []) rows.push({ ...(r as unknown as Row), key: `${r.user_id}|${r.product_id}`, table: "purchases" });
  const bk = await db
    .from("bookings")
    .select("id,user_id,created_at,nudge_2h_at,nudge_24h_at,status,payment_status")
    .neq("payment_status", "paid")
    .in("status", ["expired", "cancelled", "awaiting_payment"])
    .not("user_id", "is", null)
    .gte("created_at", since)
    .lte("created_at", twoHoursAgo)
    .is("nudge_24h_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  for (const r of bk.error ? [] : bk.data ?? []) {
    // a booking the student or admin cancelled after paying isn't "unfinished"
    if ((r as { status: string }).status === "cancelled" && (r as { payment_status: string }).payment_status !== "failed") continue;
    rows.push({ ...(r as unknown as Row), key: `${r.user_id}|booking`, table: "bookings" });
  }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const seen = new Set<string>();
  for (const r of rows) {
    const stamp = new Date().toISOString();
    // Only the newest attempt per student + item; older ones are quietly closed
    if (seen.has(r.key)) {
      await db.from(r.table).update({ nudge_2h_at: r.nudge_2h_at ?? stamp, nudge_24h_at: stamp }).eq("id", r.id);
      continue;
    }
    seen.add(r.key);
    const age = now - new Date(r.created_at).getTime();
    if (age >= 24 * 3_600_000) {
      if (await claim(db, r.table, "nudge_24h_at", r.id)) {
        if (!r.nudge_2h_at) await db.from(r.table).update({ nudge_2h_at: stamp }).eq("id", r.id); // too late for the 2-hour one
        if (await sendKind("checkout_reminder_24h", r.id)) out.r24h++;
      }
    } else if (!r.nudge_2h_at) {
      if (await claim(db, r.table, "nudge_2h_at", r.id)) {
        if (await sendKind("checkout_reminder_2h", r.id)) out.r2h++;
      }
    }
  }
  return out;
}

/** Free guide popup → email the link to read it online (in the background). */
export function notifyFreeGuide(requestId: string) {
  inBackground(async () => {
    if (await sendKind("free_guide", requestId)) {
      await getAdminSupabase()?.from("guide_requests").update({ emailed_at: new Date().toISOString() }).eq("id", requestId);
    }
  });
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
    // Add the voice call to Google Calendar (if connected). Never blocks the emails.
    await syncBookingCalendar(bookingId);
    await sendKind("booking_confirmed", bookingId);
    await sendKind("admin_booking", bookingId);
    const { data: b } = await db.from("bookings").select("payment_status").eq("id", bookingId).maybeSingle();
    if (b?.payment_status === "paid") await sendKind("admin_payment", bookingId);
  });
}

export function notifyBookingChanged(bookingId: string, change: "cancelled" | "rescheduled") {
  inBackground(async () => {
    await syncBookingCalendar(bookingId); // move or cancel the calendar event (Google updates the student's invite)
    await sendKind(change === "cancelled" ? "booking_cancelled" : "booking_rescheduled", bookingId);
  });
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
//  AFTER THE SESSION (run by /api/cron/reminders every 15 minutes)
//   • completePastBookings(): confirmed sessions whose end time has passed
//     → 'completed' (supabase/feedback.sql → complete_past_bookings()).
//   • sendDueFeedbackRequests(): 1 hour after a completed session ends,
//     the student gets the feedback email (once). Only sessions that ended
//     in the last 2 days — old ones never get a surprise email.
// ---------------------------------------------------------------------
export async function completePastBookings(): Promise<number> {
  const db = getAdminSupabase();
  if (!db) return 0;
  const { data, error } = await db.rpc("complete_past_bookings");
  if (error) {
    if (!/complete_past_bookings|function/i.test(error.message)) console.warn("[cron] complete bookings failed:", error.message);
    return 0; // feedback.sql not run yet
  }
  return Number(data) || 0;
}

export async function sendDueFeedbackRequests(): Promise<number> {
  const db = getAdminSupabase();
  if (!db) return 0;
  const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ms));
  const now = Date.now();
  const { data, error } = await db
    .from("bookings")
    .select("id,slots!inner(date,end_time)")
    .eq("status", "completed")
    .is("feedback_email_sent_at", null)
    .gte("slots.date", day(now - 2 * 86400000))
    .lte("slots.date", day(now))
    .limit(100);
  if (error) return 0; // feedback.sql not run yet
  let sent = 0;
  for (const b of (data ?? []) as unknown as { id: string; slots: { date: string; end_time: string } }[]) {
    const ended = slotStart(b.slots.date, b.slots.end_time).getTime();
    if (now - ended < 60 * 60000 || now - ended > 48 * 3600000) continue; // 1 hour after it ends, within 2 days
    if (await claim(db, "bookings", "feedback_email_sent_at", b.id)) {
      if (await sendKind("feedback_request", b.id)) sent++;
    }
  }
  return sent;
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
