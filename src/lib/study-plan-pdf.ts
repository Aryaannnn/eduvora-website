// A student's day-wise study plan → printable PDF (server only, pdf-lib).
// EDUVORA logo, course, student, start date, then every day with its date,
// subjects, topics, linked PDFs (titles only — no links), note and a tick box.
import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFPage } from "pdf-lib";
import { siteConfig } from "@/config/site";
import { logo, plain, wrap } from "./college-plan-pdf";
import { addDays, type PlanDay } from "./study-plan";

const NAVY = rgb(11 / 255, 42 / 255, 91 / 255);
const GOLD = rgb(242 / 255, 169 / 255, 0);
const TEXT = rgb(0.2, 0.25, 0.33);
const MUTED = rgb(0.42, 0.47, 0.55);
const GREEN = rgb(0.02, 0.59, 0.41);

const dateText = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export async function studyPlanPdf(info: { course: string; student: string; start: string; days: PlanDay[]; done: Set<string>; fileNames: Record<string, string> }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = plain(siteConfig.businessName) || "EDUVORA";
  pdf.setTitle(`${brand} - Study plan - ${plain(info.course)}`);
  pdf.setAuthor(brand);

  const W = 595.28, H = 841.89, M = 44, CW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const need = (h: number) => {
    if (y - h < M + 30) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // header
  const lb = await logo();
  let img = null;
  try {
    if (lb && lb[0] === 0x89) img = await pdf.embedPng(lb);
    else if (lb && lb[0] === 0xff) img = await pdf.embedJpg(lb);
  } catch {
    img = null;
  }
  if (img) page.drawImage(img, { x: M, y: y - 40, width: (img.width / img.height) * 40, height: 40 });
  else page.drawText(brand, { x: M, y: y - 26, size: 24, font: bold, color: NAVY });
  const t = "Day-wise Study Plan";
  page.drawText(t, { x: W - M - bold.widthOfTextAtSize(t, 17), y: y - 24, size: 17, font: bold, color: NAVY });
  y -= 52;
  page.drawRectangle({ x: M, y, width: CW, height: 3, color: GOLD });
  y -= 18;
  const row = (label: string, value: string) => {
    page.drawText(label, { x: M, y: y - 10, size: 10, font: bold, color: MUTED });
    page.drawText(plain(value) || "-", { x: M + 90, y: y - 10, size: 10, font: bold, color: NAVY });
    y -= 15;
  };
  row("Course", info.course);
  row("Student", info.student);
  row("Starts on", dateText(info.start));
  row("Progress", `${info.days.filter((d) => info.done.has(d.id)).length} of ${info.days.length} days done`);
  y -= 8;

  for (const d of info.days) {
    const topics = d.topics.flatMap((x) => wrap(`- ${x}`, font, 9.5, CW - 70));
    const pdfs = d.file_ids.map((id) => info.fileNames[id]).filter(Boolean);
    const pdfLines = pdfs.length ? wrap(`PDFs: ${pdfs.join(", ")}`, font, 9, CW - 70) : [];
    const noteLines = d.note ? wrap(d.note, font, 9, CW - 70) : [];
    const h = 22 + topics.length * 13 + pdfLines.length * 12 + noteLines.length * 12 + 8;
    need(Math.min(h, 300));
    const top = y;
    const isDone = info.done.has(d.id);
    // tick box + day badge
    page.drawRectangle({ x: M, y: y - 14, width: 12, height: 12, borderColor: isDone ? GREEN : MUTED, borderWidth: 1, color: isDone ? GREEN : undefined });
    if (isDone) page.drawText("v", { x: M + 3, y: y - 12, size: 9, font: bold, color: rgb(1, 1, 1) });
    const label = `Day ${d.day_number}${d.is_sample ? " (SAMPLE)" : ""}`;
    page.drawText(label, { x: M + 20, y: y - 12, size: 11, font: bold, color: NAVY });
    const subjX = M + 20 + bold.widthOfTextAtSize(label, 11) + 12;
    const date = dateText(addDays(info.start, d.day_number - 1));
    page.drawText(date, { x: W - M - font.widthOfTextAtSize(date, 9), y: y - 11, size: 9, font, color: MUTED });
    if (d.subjects.length) page.drawText(plain(d.subjects.join(" - ")), { x: subjX, y: y - 12, size: 10, font: bold, color: TEXT });
    y -= 20;
    for (const l of topics) {
      need(13);
      page.drawText(l, { x: M + 20, y: y - 9.5, size: 9.5, font, color: TEXT });
      y -= 13;
    }
    for (const l of pdfLines) {
      need(12);
      page.drawText(l, { x: M + 20, y: y - 9, size: 9, font, color: NAVY });
      y -= 12;
    }
    for (const l of noteLines) {
      need(12);
      page.drawText(l, { x: M + 20, y: y - 9, size: 9, font, color: MUTED });
      y -= 12;
    }
    y -= 6;
    if (y < top) page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.4, color: rgb(0.85, 0.87, 0.9) });
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const f = `${brand} - ${plain(info.course)} - personal study plan for ${plain(info.student)} - page ${i + 1} of ${pages.length}`;
    p.drawText(f, { x: M, y: 22, size: 8, font, color: MUTED });
  });
  return pdf.save();
}
