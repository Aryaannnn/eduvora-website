// =====================================================================
//  PDF INVOICES — SERVER ONLY
//  One invoice per verified payment (products AND counselling bookings).
//  Invoice numbers (EDU-2026-0001, 0002 …) are given by the database when
//  a payment is marked paid, so they are unique and in order.
//  ✏️ Address / GSTIN: src/config/site.ts → invoice (address shows only if showAddress: true)
// =====================================================================
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { siteConfig } from "@/config/site";
import { formatDate, formatDateTime, formatTime } from "./format";
import { getPaymentMethod } from "./razorpay";

export type InvoiceData = {
  kind: "purchase" | "booking";
  id: string;
  userId: string;
  invoiceNumber: string;
  date: string; // ISO (paid time)
  name: string;
  email: string;
  phone: string;
  item: string;
  amount: number; // rupees (what was paid)
  /** price before discounts + each discount line (only when something was taken off) */
  subtotal?: number;
  discounts?: { label: string; amount: number }[];
  method: string;
  paymentId: string | null;
  orderId: string | null;
};

/** Collect everything for one invoice. Returns null if it isn't a paid, invoiced payment. */
export async function getInvoiceData(db: SupabaseClient, id: string): Promise<InvoiceData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  // ---- product purchase? ----
  const p = await selectTolerant(db, "purchases", "id,user_id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,payment_method,original_amount,coupon_code,coupon_discount,referral_discount,reward_used,products(title)", id);
  if (p) {
    if (p.status !== "paid" || !p.invoice_number) return null;
    const { data: prof } = await db.from("profiles").select("full_name,email,phone").eq("id", p.user_id).maybeSingle();
    const method = await methodFor(db, "purchases", p.id, p.payment_method as string | null, p.razorpay_payment_id as string | null, Number(p.amount));
    return {
      kind: "purchase",
      id: p.id,
      userId: p.user_id,
      invoiceNumber: p.invoice_number,
      date: (p.paid_at as string | null) ?? p.created_at,
      name: prof?.full_name || "Student",
      email: prof?.email || "",
      phone: prof?.phone ? `+${String(prof.phone).replace(/^\+/, "")}` : "",
      item: (p.products as unknown as { title: string } | null)?.title ?? "Purchase",
      amount: Number(p.amount),
      ...discountLines(p),
      method,
      paymentId: p.razorpay_payment_id,
      orderId: p.razorpay_order_id,
    };
  }

  // ---- counselling booking? ----
  const b = await selectTolerant(db, "bookings", "id,user_id,name,phone,email,amount,payment_status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,payment_method,original_amount,coupon_code,coupon_discount,referral_discount,reward_used,slots(date,start_time,end_time,price)", id);
  if (!b || b.payment_status !== "paid" || !b.invoice_number) return null;
  const slot = b.slots as unknown as { date: string; start_time: string; end_time: string; price: number } | null;
  const { data: prof } = await db.from("profiles").select("email").eq("id", b.user_id).maybeSingle();
  const amount = Number(b.amount ?? slot?.price ?? 0);
  return {
    kind: "booking",
    id: b.id,
    userId: b.user_id,
    invoiceNumber: b.invoice_number,
    date: (b.paid_at as string | null) ?? b.created_at,
    name: b.name || "Student",
    email: b.email || prof?.email || "",
    phone: b.phone || "",
    item: `One-to-one counselling session${slot ? ` - ${formatDate(slot.date, true)}, ${formatTime(slot.start_time)}-${formatTime(slot.end_time)} IST` : ""}`,
    amount,
    ...discountLines(b),
    method: await methodFor(db, "bookings", b.id, b.payment_method as string | null, b.razorpay_payment_id as string | null, amount),
    paymentId: b.razorpay_payment_id,
    orderId: b.razorpay_order_id,
  };
}

/** Coupon / referral / reward lines for the invoice (supabase/coupons-referrals.sql). */
function discountLines(r: Record<string, unknown>): Pick<InvoiceData, "subtotal" | "discounts"> {
  const original = Number(r.original_amount ?? 0);
  if (!original || original <= Number(r.amount)) return {};
  const lines: { label: string; amount: number }[] = [];
  if (Number(r.coupon_discount) > 0) lines.push({ label: `Coupon discount (${r.coupon_code ?? "code"})`, amount: Number(r.coupon_discount) });
  if (Number(r.referral_discount) > 0) lines.push({ label: "Referral discount (first payment)", amount: Number(r.referral_discount) });
  if (Number(r.reward_used) > 0) lines.push({ label: "Reward credit used", amount: Number(r.reward_used) });
  return { subtotal: original, discounts: lines };
}

/** Select one row; if a newer column (e.g. payment_method) doesn't exist yet, try again without it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selectTolerant(db: SupabaseClient, table: string, cols: string, id: string): Promise<any> {
  let list = cols.split(",");
  for (let i = 0; i < 10; i++) {
    const { data, error } = await db.from(table).select(list.join(",")).eq("id", id).maybeSingle();
    if (!error) return data;
    const missing = /column [\w.]*?\.?(\w+) does not exist/.exec(error.message)?.[1];
    if (!missing || !list.includes(missing)) return null;
    list = list.filter((c) => c !== missing);
  }
  return null;
}

// Payment method: saved on the row; looked up from Razorpay the first time
async function methodFor(db: SupabaseClient, table: "purchases" | "bookings", id: string, saved: string | null, paymentId: string | null, amount: number) {
  if (saved) return saved;
  if (!paymentId) return amount === 0 ? "Free" : "Recorded by EDUVORA";
  const m = await getPaymentMethod(paymentId);
  if (m) await db.from(table).update({ payment_method: m }).eq("id", id); // remember it
  return m ?? "Online (Razorpay)";
}

// ---------------------------------------------------------------------
//  PDF drawing (A4, EDUVORA navy + gold)
// ---------------------------------------------------------------------
const NAVY = rgb(11 / 255, 42 / 255, 91 / 255);
const GOLD = rgb(242 / 255, 169 / 255, 0);
const GREY = rgb(0.4, 0.45, 0.52);
const DARK = rgb(0.1, 0.12, 0.16);
const LINE = rgb(0.88, 0.9, 0.93);

// The built-in PDF font only knows basic Latin letters → swap the rest
const clean = (s: string) =>
  s
    .replace(/₹/g, "Rs.")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[   ]/g, " ")
    .replace(/·/g, "|")
    .replace(/[^\x20-\x7E]/g, "");
const money = (n: number) => `INR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let logoBytes: Uint8Array | null | undefined;
async function logo() {
  if (logoBytes !== undefined) return logoBytes;
  try {
    logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "logo-email.png")));
  } catch {
    logoBytes = null;
  }
  return logoBytes;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildInvoicePdf(inv: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${inv.invoiceNumber}`);
  pdf.setAuthor(siteConfig.billingName);
  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const text = (s: string, x: number, y: number, size = 10, f = font, color = DARK) => page.drawText(clean(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, y: number, size = 10, f = font, color = DARK) => {
    const c = clean(s);
    page.drawText(c, { x: xRight - f.widthOfTextAtSize(c, size), y, size, font: f, color });
  };

  // ---- header band ----
  page.drawRectangle({ x: 0, y: height - 130, width, height: 130, color: NAVY });
  page.drawRectangle({ x: 0, y: height - 134, width, height: 4, color: GOLD });
  const img = await logo();
  let textX = M;
  if (img) {
    const png = await pdf.embedPng(img);
    const h = 64, w = (png.width / png.height) * h;
    page.drawRectangle({ x: M - 8, y: height - 104, width: w + 16, height: h + 16, color: rgb(1, 1, 1) });
    page.drawImage(png, { x: M, y: height - 96, width: w, height: h });
    textX = M + w + 24;
  }
  text(siteConfig.billingName, textX, height - 62, 22, bold, rgb(1, 1, 1));
  text(siteConfig.tagline, textX, height - 80, 10, font, GOLD);
  text(siteConfig.nameMeaning, textX, height - 94, 8, font, rgb(0.8, 0.84, 0.9));
  right("INVOICE", width - M, height - 60, 20, bold, GOLD);
  right(inv.invoiceNumber, width - M, height - 80, 12, bold, rgb(1, 1, 1));
  right(formatDateTime(inv.date), width - M, height - 96, 9, font, rgb(0.85, 0.88, 0.94));

  // ---- seller / buyer ----
  let y = height - 172;
  text("FROM", M, y, 8, bold, GREY);
  text("BILLED TO", width / 2 + 10, y, 8, bold, GREY);
  y -= 16;
  const from = [
    siteConfig.billingName,
    ...(siteConfig.showAddress ? wrap(siteConfig.invoice.address, font, 10, width / 2 - M - 20) : []), // hidden unless showAddress
    siteConfig.email,
  ];
  if (siteConfig.invoice.gstin.trim()) from.push(`GSTIN: ${siteConfig.invoice.gstin.trim()}`);
  const to = [inv.name, inv.email, inv.phone].filter(Boolean);
  const rows = Math.max(from.length, to.length);
  for (let i = 0; i < rows; i++) {
    if (from[i]) text(from[i], M, y, 10, i === 0 ? bold : font);
    if (to[i]) text(to[i], width / 2 + 10, y, 10, i === 0 ? bold : font);
    y -= 15;
  }

  // ---- items table ----
  y -= 18;
  page.drawRectangle({ x: M, y: y - 8, width: width - 2 * M, height: 26, color: rgb(0.95, 0.96, 0.98) });
  text("DESCRIPTION", M + 10, y, 9, bold, GREY);
  right("AMOUNT", width - M - 10, y, 9, bold, GREY);
  y -= 30;
  const itemLines = wrap(inv.item, font, 11, width - 2 * M - 160);
  itemLines.forEach((l, i) => text(l, M + 10, y - i * 15, 11, i === 0 ? bold : font));
  right(money(inv.subtotal ?? inv.amount), width - M - 10, y, 11, bold);
  y -= itemLines.length * 15 + 10;
  for (const d of inv.discounts ?? []) {
    text(d.label, M + 10, y, 10, font, GREY);
    right(`- ${money(d.amount)}`, width - M - 10, y, 10, bold, rgb(0.02, 0.47, 0.34));
    y -= 16;
  }
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE });

  // ---- total ----
  y -= 30;
  page.drawRectangle({ x: width / 2, y: y - 12, width: width / 2 - M, height: 36, color: NAVY });
  text("TOTAL PAID", width / 2 + 14, y, 10, bold, GOLD);
  right(money(inv.amount), width - M - 14, y, 14, bold, rgb(1, 1, 1));

  // ---- payment details ----
  y -= 60;
  text("PAYMENT DETAILS", M, y, 8, bold, GREY);
  y -= 18;
  const pay: [string, string][] = [
    ["Payment method", inv.method],
    ["Status", "Paid"],
    ...(inv.paymentId ? ([["Razorpay payment ID", inv.paymentId]] as [string, string][]) : []),
    ...(inv.orderId ? ([["Razorpay order ID", inv.orderId]] as [string, string][]) : []),
    ["Paid on", formatDateTime(inv.date)],
  ];
  for (const [k, v] of pay) {
    text(k, M, y, 10, font, GREY);
    text(v, M + 140, y, 10, bold);
    y -= 16;
  }

  // ---- footer ----
  page.drawLine({ start: { x: M, y: 90 }, end: { x: width - M, y: 90 }, thickness: 1, color: LINE });
  text(siteConfig.invoice.footerNote, M, 72, 9, font, GREY);
  text("All dates and times are in Indian Standard Time (IST, UTC+5:30).", M, 58, 8, font, GREY);
  text(`${siteConfig.siteUrl.replace(/^https?:\/\//, "")}  |  ${siteConfig.email}`, M, 44, 8, font, NAVY);

  return pdf.save();
}

export const invoiceFileName = (inv: InvoiceData) => `${inv.invoiceNumber}.pdf`;
