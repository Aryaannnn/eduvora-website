// =====================================================================
//  PDF INVOICES — SERVER ONLY
//  One invoice per verified payment (products AND counselling bookings).
//  • Invoice numbers (EDU-2026-0001, 0002 …) are given by the database when
//    a payment is marked paid, so they are unique and in order.
//  • The FIRST time an invoice is made, everything printed on it is saved in
//    the locked "invoices" table (supabase/invoices.sql). Every later email /
//    download uses that copy, so an invoice never changes afterwards.
//  • The same builder is used for the email attachment, the student's
//    download and the admin download.
//  ✏️ Address / GSTIN / Udyam / signature: src/config/site.ts → invoice
//  ✏️ Signature image: Supabase → Storage → bucket "assets" → signature.png (private)
// =====================================================================
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { siteConfig } from "@/config/site";
import { fullContactForPaidStudent } from "./contact";
import { formatDate, formatDateTime, formatTime } from "./format";
import { amountInWords, gstFromInclusive, stateFromGstin, type GstLine } from "./invoice-math";
import { getPaymentMethod } from "./razorpay";
import { getAdminSupabase } from "./supabase/admin";

export type InvoiceSeller = { name: string; tagline: string; address: string; email: string; phone: string; gstin: string; udyam: string };
export type InvoiceGst = { gstin: string; ratePercent: number; sac: string; state: { code: string; name: string }; taxable: number; lines: GstLine[] };

export type InvoiceData = {
  version: 2;
  kind: "purchase" | "booking";
  id: string;
  /** the student (null after their account was deleted — then only admins can open it) */
  userId: string | null;
  invoiceNumber: string;
  /** ISO — when the payment was confirmed (= when the invoice number was given) */
  date: string;
  name: string;
  email: string;
  phone: string;
  /** one line, e.g. for emails */
  item: string;
  itemTitle: string;
  itemDetail: string;
  quantity: number;
  /** price before discounts (rupees) */
  rate: number;
  discounts: { label: string; amount: number }[];
  /** what was paid (rupees) */
  amount: number;
  method: string;
  paymentId: string | null;
  orderId: string | null;
  /** seller details AS PRINTED when the invoice was made */
  seller: InvoiceSeller;
  gst: InvoiceGst | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  crash_course: "Crash course",
  study_material: "Study material (digital)",
  previous_paper: "Previous year papers (digital)",
  mock_test: "Mock test pack (online)",
  counselling_package: "Counselling package",
};

// ---------------------------------------------------------------------
//  DATA
// ---------------------------------------------------------------------
/** Collect everything for one invoice. Returns null if it isn't a paid, invoiced payment. */
export async function getInvoiceData(db: SupabaseClient, id: string): Promise<InvoiceData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  // 1. Already made once? → the locked copy (never changes)
  const saved = await db.from("invoices").select("data,user_id").eq("source_id", id).maybeSingle();
  if (saved.data?.data) return { ...(saved.data.data as InvoiceData), userId: (saved.data.user_id as string | null) ?? null };
  const canSave = !saved.error; // table missing → supabase/invoices.sql not run yet (works as before)

  // 2. First time → build it from the payment, then save the copy
  const inv = await buildFromPayment(db, id);
  if (!inv) return null;
  if (canSave) {
    const { error } = await db.from("invoices").insert({
      invoice_number: inv.invoiceNumber,
      source_kind: inv.kind,
      source_id: inv.id,
      user_id: inv.userId,
      data: inv,
    });
    if (error) {
      // Someone else saved it at the same moment → use theirs, so both are identical
      const again = await db.from("invoices").select("data,user_id").eq("source_id", id).maybeSingle();
      if (again.data?.data) return { ...(again.data.data as InvoiceData), userId: (again.data.user_id as string | null) ?? null };
      console.warn("invoices: could not save the locked copy:", error.message);
    }
  }
  return inv;
}

async function buildFromPayment(db: SupabaseClient, id: string): Promise<InvoiceData | null> {
  // ---- product purchase? ----
  const p = await selectTolerant(db, "purchases", "id,user_id,amount,status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,payment_method,original_amount,coupon_code,coupon_discount,referral_discount,reward_used,products(title,category)", id);
  if (p) {
    if (p.status !== "paid" || !p.invoice_number) return null;
    const { data: prof } = await db.from("profiles").select("full_name,email,phone").eq("id", p.user_id).maybeSingle();
    const amount = Number(p.amount);
    const product = p.products as unknown as { title: string; category?: string } | null;
    const title = product?.title ?? "Purchase";
    return finish({
      kind: "purchase",
      id: p.id,
      userId: p.user_id,
      invoiceNumber: p.invoice_number,
      date: (p.paid_at as string | null) ?? p.created_at,
      name: prof?.full_name || "Student",
      email: prof?.email || "",
      phone: prof?.phone ? `+${String(prof.phone).replace(/^\+/, "")}` : "",
      itemTitle: title,
      itemDetail: CATEGORY_LABEL[product?.category ?? ""] ?? "",
      amount,
      ...pricing(p, amount),
      method: await methodFor(db, "purchases", p.id, p.payment_method as string | null, p.razorpay_payment_id as string | null, amount),
      paymentId: p.razorpay_payment_id,
      orderId: p.razorpay_order_id,
    });
  }

  // ---- counselling booking? ----
  const b = await selectTolerant(db, "bookings", "id,user_id,name,phone,email,amount,payment_status,invoice_number,razorpay_order_id,razorpay_payment_id,created_at,paid_at,payment_method,original_amount,coupon_code,coupon_discount,referral_discount,reward_used,slots(date,start_time,end_time,price)", id);
  if (!b || b.payment_status !== "paid" || !b.invoice_number) return null;
  const slot = b.slots as unknown as { date: string; start_time: string; end_time: string; price: number } | null;
  const { data: prof } = await db.from("profiles").select("email").eq("id", b.user_id).maybeSingle();
  const amount = Number(b.amount ?? slot?.price ?? 0);
  const phone = String(b.phone ?? "").replace(/\D/g, "");
  return finish({
    kind: "booking",
    id: b.id,
    userId: b.user_id,
    invoiceNumber: b.invoice_number,
    date: (b.paid_at as string | null) ?? b.created_at,
    name: b.name || "Student",
    email: b.email || prof?.email || "",
    phone: phone.length >= 10 ? `+${phone.length === 10 ? `91${phone}` : phone}` : "",
    itemTitle: "One-to-one counselling session (video call)",
    itemDetail: slot ? `Session: ${formatDate(slot.date, true)}, ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)} IST` : "",
    amount,
    ...pricing(b, amount),
    method: await methodFor(db, "bookings", b.id, b.payment_method as string | null, b.razorpay_payment_id as string | null, amount),
    paymentId: b.razorpay_payment_id,
    orderId: b.razorpay_order_id,
  });
}

/** Adds the one-line item, the seller details and GST — as they are TODAY (then locked). */
function finish(d: Omit<InvoiceData, "version" | "item" | "quantity" | "seller" | "gst">): InvoiceData {
  return {
    version: 2,
    ...d,
    item: d.itemDetail && d.kind === "booking" ? `${d.itemTitle} - ${d.itemDetail.replace(/^Session: /, "")}` : d.itemTitle,
    quantity: 1,
    seller: currentSeller(d.amount > 0),
    gst: currentGst(d.amount),
  };
}

/** Price before discounts + each discount line (supabase/coupons-referrals.sql). */
function pricing(r: Record<string, unknown>, paid: number): Pick<InvoiceData, "rate" | "discounts"> {
  const original = Number(r.original_amount ?? 0);
  if (!original || original <= paid) return { rate: paid, discounts: [] };
  const lines: { label: string; amount: number }[] = [];
  if (Number(r.coupon_discount) > 0) lines.push({ label: `Coupon ${String(r.coupon_code ?? "").toUpperCase() || "discount"}`, amount: Number(r.coupon_discount) });
  if (Number(r.referral_discount) > 0) lines.push({ label: "Referral discount", amount: Number(r.referral_discount) });
  if (Number(r.reward_used) > 0) lines.push({ label: "Reward credit used", amount: Number(r.reward_used) });
  // Anything not explained by the lines above (rounding etc.)
  const rest = Math.round((original - paid - lines.reduce((s, l) => s + l.amount, 0)) * 100) / 100;
  if (rest > 0) lines.push({ label: "Discount", amount: rest });
  return { rate: original, discounts: lines };
}

/** The seller box. The full phone number only goes on invoices for real (paid) payments. */
export function currentSeller(paid = true): InvoiceSeller {
  const c = siteConfig.invoice;
  return {
    name: siteConfig.billingName,
    tagline: siteConfig.tagline,
    address: c.address.trim(),
    email: siteConfig.email,
    phone: (paid ? fullContactForPaidStudent()?.display : null) ?? siteConfig.phoneMasked,
    gstin: c.gstin.trim().toUpperCase(),
    udyam: c.udyam.trim().toUpperCase(),
  };
}

/** GST only when a valid GSTIN is set in the config. */
function currentGst(total: number, gstin = siteConfig.invoice.gstin): InvoiceGst | null {
  const g = gstin.trim().toUpperCase();
  const state = g ? stateFromGstin(g) : null;
  if (!g || !state) return null;
  const rate = siteConfig.invoice.gstRatePercent;
  const b = gstFromInclusive(total, rate);
  return { gstin: g, ratePercent: rate, sac: siteConfig.invoice.sac, state, taxable: b.taxable, lines: b.lines };
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

/** Dummy invoice for Admin → Settings → "Preview sample invoice" (no real student data). */
export function sampleInvoice(withGst = false): InvoiceData {
  const now = new Date().toISOString();
  const inv: InvoiceData = {
    version: 2,
    kind: "booking",
    id: "00000000-0000-4000-8000-000000000000",
    userId: null,
    invoiceNumber: `EDU-${new Date().getFullYear()}-0000`,
    date: now,
    name: "Riya Sharma (sample)",
    email: "student@example.com",
    phone: "+91 98765 00000",
    item: "",
    itemTitle: "One-to-one counselling session (video call)",
    itemDetail: "Session: Sat, 21 Nov 2026, 5:00 PM - 5:45 PM IST",
    quantity: 1,
    rate: 1999,
    discounts: [{ label: "Coupon WELCOME500", amount: 500 }],
    amount: 1499,
    method: "UPI (Google Pay)",
    paymentId: "pay_SAMPLE0000000001",
    orderId: "order_SAMPLE00000001",
    seller: currentSeller(false),
    gst: withGst ? currentGst(1499, siteConfig.invoice.gstin.trim() || "33ABCDE1234F1Z5") : currentGst(1499),
  };
  inv.item = `${inv.itemTitle} - ${inv.itemDetail.replace(/^Session: /, "")}`;
  return inv;
}

// ---------------------------------------------------------------------
//  SIGNATURE (private) + LOGO
// ---------------------------------------------------------------------
export const SIGNATURE_BUCKET = "assets";
export const SIGNATURE_FILE = "signature.png";

let sigCache: { at: number; bytes: Uint8Array | null } | null = null;
/**
 * Reads signature.png from the PRIVATE Supabase Storage bucket "assets" with the
 * server-only key. Cached for 10 minutes. Missing / broken file → null (the invoice
 * is simply made without a signature). It is never given a public link.
 */
export async function loadSignature(): Promise<Uint8Array | null> {
  if (!siteConfig.invoice.showSignature) return null;
  if (sigCache && Date.now() - sigCache.at < 10 * 60_000) return sigCache.bytes;
  let bytes: Uint8Array | null = null;
  try {
    const db = getAdminSupabase();
    const { data } = db ? await db.storage.from(SIGNATURE_BUCKET).download(SIGNATURE_FILE) : { data: null };
    if (data && data.size > 0 && data.size < 2_000_000) bytes = new Uint8Array(await data.arrayBuffer());
  } catch {
    bytes = null;
  }
  sigCache = { at: Date.now(), bytes };
  return bytes;
}

let logoBytes: Uint8Array | null | undefined;
async function logo() {
  if (logoBytes !== undefined) return logoBytes;
  try {
    logoBytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "logo-email.png")));
  } catch {
    try {
      const res = await fetch(`${siteConfig.siteUrl}/logo-email.png`, { cache: "force-cache" });
      logoBytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    } catch {
      logoBytes = null;
    }
  }
  return logoBytes;
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes) return null;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes); // PNG
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes); // JPEG saved as .png
  } catch {
    /* broken image → no image */
  }
  return null;
}

// ---------------------------------------------------------------------
//  PDF (one A4 page, EDUVORA navy + gold, prints well in black & white)
// ---------------------------------------------------------------------
const NAVY = rgb(11 / 255, 42 / 255, 91 / 255);
const GOLD = rgb(242 / 255, 169 / 255, 0);
const GOLD_DARK = rgb(161 / 255, 108 / 255, 0);
const GREY = rgb(0.39, 0.45, 0.53);
const DARK = rgb(0.09, 0.11, 0.16);
const LINE = rgb(0.86, 0.89, 0.93);
const SOFT = rgb(0.965, 0.973, 0.984);
const GREEN = rgb(0.02, 0.5, 0.33);
const WHITE = rgb(1, 1, 1);

// The built-in PDF font only knows basic Latin letters → swap the rest (₹ is drawn as a shape)
const clean = (s: string) =>
  s
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[   ]/g, " ")
    .replace(/[·•]/g, "|")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7E]/g, "");
const num = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "₹" drawn as lines (Helvetica has no ₹), in a 10 × 14 box
const RUPEE_PATH = "M0.6 1 H9.4 M0.6 4.6 H9.4 M0.6 1 H3.4 C7.9 1 7.9 8.1 3.4 8.1 H1.2 L7.9 14.2";

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = clean(text).split(/\s+/).filter(Boolean);
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

export type InvoicePdfOptions = {
  sample?: boolean;
  /** for tests only: use these image bytes instead of loading signature.png */
  signatureBytes?: Uint8Array | null;
};

export async function buildInvoicePdf(inv: InvoiceData, opts: InvoicePdfOptions = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${inv.gst ? "Tax Invoice" : "Invoice"} ${inv.invoiceNumber}`);
  pdf.setAuthor(inv.seller.name);
  pdf.setCreator(inv.seller.name);
  pdf.setSubject(`Invoice for ${clean(inv.itemTitle)}`);
  const page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const { width: W, height: H } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 40; // margin
  const R = W - M; // right edge
  const footTop = 770; // footer line (from the top)
  const Y = (t: number) => H - t; // measure from the TOP of the page

  const text = (s: string, x: number, t: number, size = 9.5, f: PDFFont = font, color: RGB = DARK) => page.drawText(clean(s), { x, y: Y(t), size, font: f, color });
  const width = (s: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(clean(s), size);
  const rightText = (s: string, xRight: number, t: number, size = 9.5, f: PDFFont = font, color: RGB = DARK) => text(s, xRight - width(s, size, f), t, size, f, color);
  const rupee = (x: number, t: number, size: number, color: RGB) =>
    page.drawSvgPath(RUPEE_PATH, { x, y: Y(t) + size * 0.74, scale: size / 14.5, borderColor: color, borderWidth: Math.max(0.8, size / 11) / (size / 14.5) });
  /** "₹ 1,499.00" right-aligned */
  const money = (n: number, xRight: number, t: number, size = 9.5, f: PDFFont = font, color: RGB = DARK, minus = false) => {
    const s = num(n);
    const w = width(s, size, f);
    rightText(s, xRight, t, size, f, color);
    rupee(xRight - w - size * 0.85, t, size, color);
    if (minus) rightText("-", xRight - w - size * 1.1, t, size, f, color); // "- ₹500.00"
  };
  const box = (x: number, top: number, w: number, h: number, fill = SOFT, border = LINE) =>
    page.drawRectangle({ x, y: Y(top + h), width: w, height: h, color: fill, borderColor: border, borderWidth: 0.8 });
  const hr = (t: number, x1 = M, x2 = R, color = LINE, thickness = 0.8) => page.drawLine({ start: { x: x1, y: Y(t) }, end: { x: x2, y: Y(t) }, thickness, color });
  const label = (s: string, x: number, t: number, color: RGB = GREY) => text(s.toUpperCase(), x, t, 7.5, bold, color);

  // ---------------- top bands ----------------
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 13, width: W, height: 3, color: GOLD });

  // ---------------- 1. header ----------------
  const logoImg = await embedImage(pdf, await logo());
  if (logoImg) {
    const h = 62, w = (logoImg.width / logoImg.height) * h;
    page.drawImage(logoImg, { x: M - 4, y: Y(34 + h), width: w, height: h });
  } else {
    text(inv.seller.name, M, 62, 22, bold, NAVY);
  }
  const title = inv.gst ? "TAX INVOICE" : "INVOICE / RECEIPT";
  rightText(title, R, 52, 20, bold, NAVY);
  page.drawRectangle({ x: R - 46, y: Y(60), width: 46, height: 2.5, color: GOLD });
  const meta: [string, string][] = [
    ["Invoice No.", inv.invoiceNumber],
    ["Invoice date", formatDate(istDay(inv.date), true)],
    ["Payment date", formatDateTime(inv.date)],
  ];
  meta.forEach(([k, v], i) => {
    const t = 78 + i * 14;
    rightText(v, R, t, 9.5, bold);
    rightText(k, R - 140, t, 8.5, font, GREY);
  });
  hr(126);

  // ---------------- 2 + 3. seller + billed to ----------------
  const colW = (R - M - 14) / 2;
  const sx = M, bx = M + colW + 14;
  const s = inv.seller;
  type BoxLine = { s: string; f: PDFFont; c: RGB; size: number };
  // Every line wraps inside its box (long names, emails or addresses never spill out)
  const fit = (str: string, f: PDFFont, c: RGB, size: number, max = 2): BoxLine[] =>
    wrap(str, f, size, colW - 26).slice(0, max).map((l) => ({ s: l, f, c, size }));
  const sellerLines: BoxLine[] = [
    ...fit(s.name, bold, NAVY, 11, 1),
    ...fit(s.tagline, font, GOLD_DARK, 8.5, 1),
    ...(s.address ? fit(s.address, font, DARK, 9) : []),
    ...fit(`Email: ${s.email}`, font, DARK, 9, 1),
    ...(s.phone ? fit(`Phone: ${s.phone}`, font, DARK, 9, 1) : []),
    ...(s.gstin ? fit(`GSTIN: ${s.gstin}`, bold, DARK, 9, 1) : []),
    ...(s.udyam ? fit(`Udyam Reg. No.: ${s.udyam}`, font, DARK, 9, 1) : []),
  ];
  const buyerLines: BoxLine[] = [
    ...fit(inv.name, bold, NAVY, 11),
    ...(inv.email ? fit(`Email: ${inv.email}`, font, DARK, 9) : []),
    ...(inv.phone ? fit(`Phone: ${inv.phone}`, font, DARK, 9, 1) : []),
    ...(inv.gst ? fit(`Place of supply: ${inv.gst.state.name} (${inv.gst.state.code})`, font, DARK, 9) : []),
  ];
  const partyTop = 140;
  const partyH = 28 + Math.max(sellerLines.length, buyerLines.length) * 12.5;
  box(sx, partyTop, colW, partyH);
  box(bx, partyTop, colW, partyH);
  page.drawRectangle({ x: sx, y: Y(partyTop + partyH), width: 3, height: partyH, color: NAVY });
  page.drawRectangle({ x: bx, y: Y(partyTop + partyH), width: 3, height: partyH, color: GOLD });
  label("From", sx + 14, partyTop + 16);
  label("Billed to", bx + 14, partyTop + 16);
  sellerLines.forEach((l, i) => text(l.s, sx + 14, partyTop + 32 + i * 12.5, l.size, l.f, l.c));
  buyerLines.forEach((l, i) => text(l.s, bx + 14, partyTop + 32 + i * 12.5, l.size, l.f, l.c));

  // ---------------- 4. items table ----------------
  let t = partyTop + partyH + 20;
  const col = {
    no: M + 10,
    desc: M + 34,
    qty: M + 300, // centre
    rate: M + 372, // right edges ↓
    disc: M + 440,
    amt: R - 10,
  };
  page.drawRectangle({ x: M, y: Y(t + 22), width: R - M, height: 22, color: NAVY });
  const hy = t + 14.5;
  text("#", col.no, hy, 8, bold, WHITE);
  text("DESCRIPTION", col.desc, hy, 8, bold, WHITE);
  text("QTY", col.qty - width("QTY", 8, bold) / 2, hy, 8, bold, WHITE);
  rightText("RATE", col.rate, hy, 8, bold, WHITE);
  rightText("DISCOUNT", col.disc, hy, 8, bold, WHITE);
  rightText("AMOUNT", col.amt, hy, 8, bold, WHITE);
  t += 22;

  const discountTotal = Math.round(inv.discounts.reduce((a, d) => a + d.amount, 0) * 100) / 100;
  const descW = col.qty - 22 - col.desc;
  const titleLines = wrap(inv.itemTitle, bold, 10, descW).slice(0, 2);
  const detailLines = [
    ...(inv.itemDetail ? wrap(inv.itemDetail, font, 8.5, descW).slice(0, 2) : []),
    ...(inv.gst ? [`SAC: ${inv.gst.sac}`] : []),
    ...inv.discounts.slice(0, 1).map((d) => `${d.label} applied`),
  ];
  const rowH = 14 + titleLines.length * 13 + detailLines.length * 11;
  const rt = t + 17;
  text("1", col.no, rt, 9.5);
  titleLines.forEach((l, i) => text(l, col.desc, rt + i * 13, 10, bold));
  detailLines.forEach((l, i) => text(l, col.desc, rt + titleLines.length * 13 + i * 11 - 1, 8.5, font, GREY));
  text(String(inv.quantity), col.qty - width(String(inv.quantity), 9.5) / 2, rt, 9.5);
  money(inv.rate, col.rate, rt);
  if (discountTotal > 0) money(discountTotal, col.disc, rt, 9.5, font, GREEN, true);
  else rightText("-", col.disc, rt, 9.5, font, GREY);
  money(inv.amount, col.amt, rt, 9.5, bold);
  t += rowH;
  hr(t, M, R, NAVY, 1);

  // ---------------- 5. totals + amount in words ----------------
  const totW = 232, tx = R - totW;
  let tt = t + 17;
  const totalRow = (k: string, v: number, opt: { minus?: boolean; color?: RGB; f?: PDFFont } = {}) => {
    text(k, tx + 10, tt, 9, opt.f ?? font, GREY);
    money(v, R - 10, tt, 9.5, opt.f ?? font, opt.color ?? DARK, opt.minus);
    tt += 15;
  };
  totalRow("Subtotal", inv.rate);
  for (const d of inv.discounts.slice(0, 3)) totalRow(d.label, d.amount, { minus: true, color: GREEN });
  if (inv.gst) {
    totalRow(`Taxable value`, inv.gst.taxable);
    for (const g of inv.gst.lines) totalRow(g.label, g.amount);
  }
  // Total bar
  page.drawRectangle({ x: tx, y: Y(tt + 22), width: totW, height: 30, color: NAVY });
  text("TOTAL", tx + 12, tt + 12, 10, bold, GOLD);
  money(inv.amount, R - 12, tt + 13, 13, bold, WHITE);
  tt += 30;
  if (inv.gst) {
    text(`Price includes GST @ ${inv.gst.ratePercent}%.`, tx + 10, tt + 12, 7.5, font, GREY);
    tt += 12;
  }

  // Amount in words (left of the totals)
  const ww = tx - M - 16;
  const words = wrap(amountInWords(inv.amount), bold, 9.5, ww - 24).slice(0, 4);
  const wordsH = 30 + words.length * 13;
  box(M, t + 10, ww, wordsH);
  label("Amount in words", M + 12, t + 25);
  words.forEach((l, i) => text(l, M + 12, t + 41 + i * 13, 9.5, bold, NAVY));

  // ---------------- 6. payment details + PAID stamp ----------------
  let pt = Math.max(tt, t + 10 + wordsH) + 22;
  label("Payment details", M, pt);
  pt += 8;
  const pay: [string, string][] = [
    ["Status", "PAID"],
    ["Payment method", inv.method],
    ...(inv.paymentId ? ([["Razorpay payment ID", inv.paymentId]] as [string, string][]) : []),
    ...(inv.orderId ? ([["Razorpay order ID", inv.orderId]] as [string, string][]) : []),
    ["Paid on", formatDateTime(inv.date)],
  ];
  const payH = 12 + pay.length * 14;
  box(M, pt, 300, payH, WHITE);
  pay.forEach(([k, v], i) => {
    const y = pt + 17 + i * 14;
    text(k, M + 12, y, 8.5, font, GREY);
    text(v, M + 130, y, 9, bold, k === "Status" ? GREEN : DARK);
  });

  // Green "PAID" stamp (rotated), to the right of the payment box
  {
    const cx = M + 300 + (R - M - 300) / 2;
    const cy = Math.min(pt + payH / 2, footTop - 44 - 92); // never over the signature
    const sw = 128, sh = 52;
    const rad = (-12 * Math.PI) / 180;
    // bottom-left corner of the rotated box so that its centre is (cx, cy)
    const ox = cx - (sw / 2) * Math.cos(rad) + (sh / 2) * Math.sin(rad);
    const oy = Y(cy) - (sw / 2) * Math.sin(rad) - (sh / 2) * Math.cos(rad);
    const at = (dx: number, dy: number) => ({ x: ox + dx * Math.cos(rad) - dy * Math.sin(rad), y: oy + dx * Math.sin(rad) + dy * Math.cos(rad) });
    page.drawRectangle({ ...at(0, 0), width: sw, height: sh, borderColor: GREEN, borderWidth: 2.5, rotate: degrees(-12), opacity: 0, borderOpacity: 0.9 });
    page.drawRectangle({ ...at(4, 4), width: sw - 8, height: sh - 8, borderColor: GREEN, borderWidth: 0.8, rotate: degrees(-12), opacity: 0, borderOpacity: 0.9 });
    const word = "PAID";
    page.drawText(word, { ...at((sw - bold.widthOfTextAtSize(word, 24)) / 2, 22), size: 24, font: bold, color: GREEN, rotate: degrees(-12), opacity: 0.9 });
    const d = clean(formatDate(istDay(inv.date), true));
    page.drawText(d, { ...at((sw - font.widthOfTextAtSize(d, 8)) / 2, 10), size: 8, font, color: GREEN, rotate: degrees(-12), opacity: 0.9 });
  }

  // ---------------- 7 + 9. terms (left) + authorised signatory (right) ----------------
  const sigW = 170, sigX = R - sigW;
  const lineT = footTop - 44; // signature line
  const sig = await embedImage(pdf, opts.signatureBytes !== undefined ? opts.signatureBytes : await loadSignature());
  if (sig) {
    const maxW = 150, maxH = 46;
    const k = Math.min(maxW / sig.width, maxH / sig.height);
    const w = sig.width * k, h = sig.height * k;
    page.drawImage(sig, { x: sigX + (sigW - w) / 2, y: Y(lineT - 2), width: w, height: h });
  }
  label(`For ${s.name}`, sigX + (sigW - width(`FOR ${s.name.toUpperCase()}`, 7.5, bold)) / 2, lineT - 54, GREY);
  hr(lineT, sigX, R, DARK, 0.8);
  const sn = siteConfig.invoice.signatory;
  text(sn.name, sigX + (sigW - width(sn.name, 9.5, bold)) / 2, lineT + 13, 9.5, bold, NAVY);
  text(sn.title, sigX + (sigW - width(sn.title, 8, font)) / 2, lineT + 25, 8, font, GREY);
  text("Authorised Signatory", sigX + (sigW - width("Authorised Signatory", 7.5, font)) / 2, lineT + 36, 7.5, font, GREY);

  const termsW = sigX - M - 30;
  label("Terms", M, lineT - 30);
  const site = siteConfig.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const terms = [
    ...wrap(`Refunds and cancellations follow our Refund & Cancellation Policy: ${site}/refund-policy`, font, 8, termsW),
    ...wrap("All dates and times are in Indian Standard Time (IST, UTC+5:30).", font, 8, termsW),
  ].slice(0, 4);
  terms.forEach((l, i) => text(l, M, lineT - 16 + i * 11, 8, font, DARK));
  text(`Thank you for choosing ${s.name}!`, M, lineT + 32, 10, bold, NAVY);

  // ---------------- footer ----------------
  hr(footTop, M, R, GOLD, 1.2);
  const foot1 = sig ? siteConfig.invoice.footerNote : `${siteConfig.invoice.footerNote} No physical signature is required.`;
  text(foot1, (W - width(foot1, 8)) / 2, footTop + 16, 8, font, GREY);
  const foot2 = `Questions about this invoice? Email ${s.email}  |  ${site}`;
  text(foot2, (W - width(foot2, 8, bold)) / 2, footTop + 29, 8, bold, NAVY);
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: NAVY });

  // ---------------- sample watermark ----------------
  if (opts.sample) {
    const wm = "SAMPLE - NOT A REAL INVOICE";
    const size = 34;
    const ww2 = bold.widthOfTextAtSize(wm, size);
    const a = (32 * Math.PI) / 180;
    page.drawText(wm, { x: W / 2 - (ww2 / 2) * Math.cos(a), y: H / 2 - (ww2 / 2) * Math.sin(a), size, font: bold, color: rgb(0.85, 0.15, 0.15), rotate: degrees(32), opacity: 0.13 });
  }

  return pdf.save();
}

/** ISO time → India date "2026-11-14" */
function istDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export const invoiceFileName = (inv: InvoiceData) => `${inv.invoiceNumber}.pdf`;
