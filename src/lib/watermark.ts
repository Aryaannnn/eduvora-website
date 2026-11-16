// =====================================================================
//  PDF WATERMARK (server only, pdf-lib)
//  Every page of the student's personal copy gets:
//   • in the middle, diagonal, light grey (15%):
//       "Licensed to <Name> • <Phone> • <Email>"
//   • a small footer:
//       "EDUVORA • For personal use only • Downloaded on <date, IST> • ID <short ID>"
//  + PDF metadata: author EDUVORA, subject with the student's email and the ID.
//  The ID is logged (Admin → Products → Downloads) so a shared copy can be traced.
//  The original file in storage is never changed, and never sent to students.
// =====================================================================
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { siteConfig } from "@/config/site";

export type WatermarkInfo = { name: string; phone: string; email: string; copyId: string; when: Date; title: string };

/** The standard PDF font can only print basic Latin letters — turn anything else into close letters or remove it. */
export function pdfSafe(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^ -~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const istStamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d) + " IST";

/** "1A2B3C4D" — printed on the copy, searchable in Admin → Products → Downloads */
export const shortCopyId = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

/** Returns the watermarked PDF. Throws if the PDF can't be read (e.g. password-protected) — never returns the original. */
export async function watermarkPdf(original: Uint8Array, info: WatermarkInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const small = await doc.embedFont(StandardFonts.Helvetica);
  const name = pdfSafe(info.name).slice(0, 60) || "Student";
  const phone = pdfSafe(info.phone).slice(0, 20);
  const email = pdfSafe(info.email).slice(0, 80);
  const brand = pdfSafe(siteConfig.businessName) || "EDUVORA";
  const mark = `Licensed to ${[name, phone, email].filter(Boolean).join(" • ")}`;
  const shortId = shortCopyId(info.copyId);
  const footer = `${brand} • For personal use only • Downloaded on ${istStamp(info.when)} • ID ${shortId}`;

  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages.");

  for (const page of pages) {
    const { width: w, height: h } = page.getSize();
    // Diagonal, through the middle of the page, about 70% of the diagonal long
    const angle = Math.atan2(h, w);
    const diag = Math.hypot(w, h);
    const size = Math.max(10, Math.min(30, (diag * 0.7) / Math.max(1, font.widthOfTextAtSize(mark, 1))));
    const tw = font.widthOfTextAtSize(mark, size);
    page.drawText(mark, {
      x: w / 2 - (tw / 2) * Math.cos(angle) + (size / 2) * Math.sin(angle),
      y: h / 2 - (tw / 2) * Math.sin(angle) - (size / 2) * Math.cos(angle),
      size,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.15,
      rotate: degrees((angle * 180) / Math.PI),
    });
    // small footer line
    let fs = 7;
    while (fs > 4 && small.widthOfTextAtSize(footer, fs) > w - 24) fs -= 0.25;
    page.drawText(footer, { x: 12, y: 8, size: fs, font: small, color: rgb(0.35, 0.35, 0.35), opacity: 0.7 });
  }

  doc.setTitle(`${brand} - ${pdfSafe(info.title) || "Study material"}`);
  doc.setAuthor(brand);
  doc.setSubject(`Licensed to ${email || name} - ID ${shortId} - personal use only`);
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
