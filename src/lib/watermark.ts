// =====================================================================
//  PDF WATERMARK (server only, pdf-lib)
//  Every page of the student's personal copy gets:
//   • across the middle, diagonal, large, light grey (20%):
//       "<Name> • <Email> • <Phone>"
//   • a small line at the TOP and at the BOTTOM:
//       "EDUVORA • Licensed to <Name> • ID <short ID> • <date, IST> • Do not share"
//  + PDF metadata: author EDUVORA, subject with the student's email and the ID.
//  Works for pages with an offset crop box and for rotated pages (the marks are
//  placed on the part of the page the viewer actually shows, upright).
//  The ID is logged (Admin → Products → Downloads) so a shared copy can be traced.
//  The original file in storage is never changed, and never sent to anyone.
// =====================================================================
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { degrees, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { siteConfig } from "@/config/site";

/** Bump when the look of the watermark changes → every cached copy is made again. */
export const WM_VERSION = 2;

export type WatermarkInfo = { name: string; phone: string; email: string; copyId: string; when: Date; title: string };

/** The standard PDF font can only print basic Latin letters — turn anything else into close letters or remove it. */
export function pdfSafe(s: string) {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^ -~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const istStamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d) + " IST";

/** "1A2B3C4D" — printed on the copy, searchable in Admin → Products → Downloads */
export const shortCopyId = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

/** The visible area of a page (crop box + rotation) → draw text by "what the reader sees" coordinates. */
function view(page: PDFPage) {
  const box = page.getCropBox();
  const rot = (((page.getRotation().angle ?? 0) % 360) + 360) % 360;
  const turned = rot === 90 || rot === 270;
  const vw = turned ? box.height : box.width;
  const vh = turned ? box.width : box.height;
  // visible (x, y) from the bottom-left of what is shown → the page's own coordinates
  const toPage = (x: number, y: number): [number, number] => {
    if (rot === 90) return [box.x + box.width - y, box.y + x];
    if (rot === 180) return [box.x + box.width - x, box.y + box.height - y];
    if (rot === 270) return [box.x + y, box.y + box.height - x];
    return [box.x + x, box.y + y];
  };
  /** text starting at visible (x, y), going at visible angle a (degrees) */
  const draw = (text: string, x: number, y: number, a: number, size: number, font: PDFFont, opacity: number, grey: number) => {
    const [px, py] = toPage(x, y);
    page.drawText(text, { x: px, y: py, size, font, color: rgb(grey, grey, grey), opacity, rotate: degrees(a + rot) });
  };
  return { vw, vh, draw };
}

/** Returns the watermarked PDF. Throws if the PDF can't be read (e.g. password-protected) — never returns the original. */
export async function watermarkPdf(original: Uint8Array, info: WatermarkInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const small = await doc.embedFont(StandardFonts.Helvetica);
  const name = pdfSafe(info.name).slice(0, 60) || "Student";
  const phone = pdfSafe(info.phone).slice(0, 20);
  const email = pdfSafe(info.email).slice(0, 80);
  const brand = pdfSafe(siteConfig.businessName) || "EDUVORA";
  const shortId = shortCopyId(info.copyId);
  const mark = [name, email, phone].filter(Boolean).join(" • ");
  const line = `${brand} • Licensed to ${name} • ID ${shortId} • ${istStamp(info.when)} • Do not share`;

  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages.");

  for (const page of pages) {
    const { vw, vh, draw } = view(page);
    if (vw < 20 || vh < 20) continue;

    // ---- big diagonal across the middle ----
    const a = Math.atan2(vh, vw);
    const diag = Math.hypot(vw, vh);
    const size = Math.max(12, Math.min(48, (diag * 0.8) / Math.max(1, bold.widthOfTextAtSize(mark, 1))));
    const tw = bold.widthOfTextAtSize(mark, size);
    const cx = vw / 2 - (tw / 2) * Math.cos(a) + size * 0.35 * Math.sin(a);
    const cy = vh / 2 - (tw / 2) * Math.sin(a) - size * 0.35 * Math.cos(a);
    draw(mark, cx, cy, (a * 180) / Math.PI, size, bold, 0.2, 0.55);

    // ---- small line at the top and the bottom ----
    let fs = 7;
    while (fs > 4 && small.widthOfTextAtSize(line, fs) > vw - 24) fs -= 0.25;
    const lw = small.widthOfTextAtSize(line, fs);
    const lx = Math.max(6, (vw - lw) / 2);
    draw(line, lx, 7, 0, fs, small, 0.75, 0.35);
    draw(line, lx, vh - 7 - fs, 0, fs, small, 0.75, 0.35);
  }

  doc.setTitle(`${brand} - ${pdfSafe(info.title) || "Study material"}`);
  doc.setAuthor(brand);
  doc.setSubject(`Licensed to ${name}${email ? ` (${email})` : ""} - ID ${shortId} - personal use only, do not share`);
  doc.setKeywords([brand, `licensed-copy-${shortId}`]);
  doc.setCreator(brand);
  doc.setProducer(`${brand} (licensed copy ${shortId})`);
  doc.setModificationDate(info.when);
  return doc.save();
}

/** Short anonymous device id (to spot one account used on many devices). Not the IP itself. */
export function deviceId(ip: string, userAgent: string) {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eduvora";
  return createHash("sha256").update(`${ip}|${userAgent}|${salt}`).digest("hex").slice(0, 10);
}

/** Delete temporary watermarked copies older than yesterday (they are only needed for ~1 minute). */
export async function cleanupWatermarked(db: SupabaseClient) {
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() - 86400000));
  const { data: folders, error } = await db.storage.from("watermarked").list("", { limit: 100 });
  if (error || !folders) return 0;
  let removed = 0;
  for (const f of folders) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.name) || f.name >= yesterday) continue;
    for (let round = 0; round < 20; round++) {
      const { data: files } = await db.storage.from("watermarked").list(f.name, { limit: 1000 });
      if (!files?.length) break;
      await db.storage.from("watermarked").remove(files.map((x) => `${f.name}/${x.name}`));
      removed += files.length;
      if (files.length < 1000) break;
    }
  }
  return removed;
}
