// College plan → PDF (server only, pdf-lib). EDUVORA logo, student name, call
// date, the plan, a short disclaimer and the counsellor's name. A4, navy + gold.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { siteConfig } from "@/config/site";
import { PLAN_DISCLAIMER, type CollegePlan } from "./college-plan";
import { pdfSafe } from "./watermark";

const NAVY = rgb(11 / 255, 42 / 255, 91 / 255);
const GOLD = rgb(242 / 255, 169 / 255, 0);
const TEXT = rgb(0.2, 0.25, 0.33);
const MUTED = rgb(0.42, 0.47, 0.55);

let logoBytes: Uint8Array | null | undefined;
/** EDUVORA logo bytes (also used by the study plan PDF) */
export async function logo() {
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

/** The standard PDF font has no "–", curly quotes or "₹" → close plain characters first */
export const plain = (t: string) =>
  pdfSafe(String(t ?? "").replace(/[–—−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹\s?/g, "Rs. ").replace(/•/g, "-").replace(/→/g, "->"));

/** Split text into lines that fit `width` */
export function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of plain(text).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function collegePlanPdf(plan: CollegePlan, info: { studentName: string; callDate: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = pdfSafe(siteConfig.businessName) || "EDUVORA";
  pdf.setTitle(`${brand} - College plan - ${pdfSafe(info.studentName)}`);
  pdf.setAuthor(brand);
  pdf.setCreator(brand);

  const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 40) newPage();
  };
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; gap?: number; width?: number } = {}) => {
    const size = opts.size ?? 10.5;
    const f = opts.f ?? font;
    for (const line of wrap(t, f, size, opts.width ?? CW - ((opts.x ?? M) - M))) {
      need(size + 4);
      page.drawText(line, { x: opts.x ?? M, y: y - size, size, font: f, color: opts.color ?? TEXT });
      y -= size + (opts.gap ?? 4);
    }
  };

  // ---- header: logo + title + gold rule ----
  const lb = await logo();
  let img = null;
  try {
    if (lb && lb[0] === 0x89) img = await pdf.embedPng(lb);
    else if (lb && lb[0] === 0xff) img = await pdf.embedJpg(lb);
  } catch {
    img = null;
  }
  if (img) {
    const h = 42, w = (img.width / img.height) * h;
    page.drawImage(img, { x: M, y: y - h, width: w, height: h });
  } else page.drawText(brand, { x: M, y: y - 26, size: 24, font: bold, color: NAVY });
  page.drawText("Your College Plan", { x: W - M - bold.widthOfTextAtSize("Your College Plan", 18), y: y - 24, size: 18, font: bold, color: NAVY });
  y -= 56;
  page.drawRectangle({ x: M, y, width: CW, height: 3, color: GOLD });
  y -= 18;

  // ---- who / when ----
  const row = (label: string, value: string) => {
    need(16);
    page.drawText(label, { x: M, y: y - 10.5, size: 10.5, font: bold, color: MUTED });
    page.drawText(plain(value) || "-", { x: M + 110, y: y - 10.5, size: 10.5, font: bold, color: NAVY });
    y -= 17;
  };
  row("Student", info.studentName);
  row("Counselling call", info.callDate);
  row("Counsellor", plan.counsellor_name || `${brand} team`);
  if (plan.fee_category) row("Expected fee", plan.fee_category);
  y -= 8;

  // ---- sections ----
  const section = (title: string, items: string[], numbered: boolean, checkbox = false) => {
    if (!items.length) return;
    need(40);
    y -= 6;
    page.drawText(plain(title), { x: M, y: y - 13, size: 13, font: bold, color: NAVY });
    y -= 22;
    items.forEach((it, i) => {
      const mark = checkbox ? "[  ]" : numbered ? `${i + 1}.` : "-";
      need(16);
      page.drawText(mark, { x: M + 4, y: y - 10.5, size: 10.5, font: bold, color: GOLD });
      text(it, { x: M + 30, width: CW - 30 });
      y -= 2;
    });
  };
  section("Recommended campuses (in order)", plan.campuses, true);
  section("Recommended branches", plan.branches, false);
  section("Choice-filling order", plan.choice_order, true);
  section("Next steps", plan.next_steps, false, true);
  if (plan.notes) {
    need(40);
    y -= 6;
    page.drawText("Notes", { x: M, y: y - 13, size: 13, font: bold, color: NAVY });
    y -= 22;
    text(plan.notes);
  }

  // ---- disclaimer + signature line ----
  need(70);
  y -= 14;
  page.drawRectangle({ x: M, y: y - 44, width: CW, height: 44, color: rgb(1, 0.98, 0.92), borderColor: GOLD, borderWidth: 0.8 });
  const dl = wrap(PLAN_DISCLAIMER, font, 9.5, CW - 20);
  dl.forEach((l, i) => page.drawText(l, { x: M + 10, y: y - 16 - i * 13, size: 9.5, font, color: TEXT }));
  y -= 60;
  text(`Prepared by ${plan.counsellor_name || `${brand} team`}, ${brand}${plan.published_at ? ` - ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(plan.published_at))}` : ""}`, { size: 9.5, color: MUTED });

  // footer on every page
  for (const p of pdf.getPages()) {
    const f = `${brand} - ${pdfSafe(siteConfig.email)} - personal guidance for ${pdfSafe(info.studentName)}`;
    p.drawText(f, { x: M, y: 24, size: 8, font, color: MUTED });
  }
  return pdf.save();
}
