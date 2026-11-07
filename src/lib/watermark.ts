// =====================================================================
//  PDF WATERMARK (server only)
//  Adds to EVERY page of the student's copy:
//   • a light diagonal "Licensed to <Name> • <Email> • EDUVORA" (grey, 15%)
//   • a small footer: download date + Download ID (traceable in
//     Admin → Products → Downloads)
//  The original file in storage is never changed.
// =====================================================================
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { siteConfig } from "@/config/site";

export type WatermarkInfo = { name: string; email: string; downloadId: string; when: Date };

/** The standard PDF font can only print basic Latin letters — turn anything else into close letters or remove it. */
export function pdfSafe(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const istStamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d) + " IST";

/** Returns the watermarked PDF. Throws if the PDF can't be read (e.g. password-protected) — never returns the original. */
export async function watermarkPdf(original: Uint8Array, info: WatermarkInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const name = pdfSafe(info.name).slice(0, 60) || "Student";
  const email = pdfSafe(info.email).slice(0, 80);
  const brand = pdfSafe(siteConfig.businessName) || "EDUVORA";
  const mark = `Licensed to ${name}${email ? ` • ${email}` : ""} • ${brand}`;
  const shortId = info.downloadId.slice(0, 8).toUpperCase();
  const footer = `Licensed to ${name}${email ? ` (${email})` : ""} · Downloaded ${istStamp(info.when)} · ID ${shortId} · Personal use only - do not share`;
  const grey = rgb(0.45, 0.45, 0.45);

  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("This PDF has no pages.");

  for (const page of pages) {
    const { width: w, height: h } = page.getSize();
    const angle = Math.atan2(h, w); // corner to corner
    const diag = Math.hypot(w, h);
    // text size: about half the diagonal long, kept readable but light
    const size = Math.max(9, Math.min(26, (diag * 0.5) / Math.max(1, font.widthOfTextAtSize(mark, 1))));
    const tw = font.widthOfTextAtSize(mark, size);
    // three PARALLEL diagonal lines: through the centre, and one on each side of it
    const gap = Math.min(w, h) * 0.27;
    for (const k of [-1, 0, 1]) {
      const cx = w / 2 - k * gap * Math.sin(angle);
      const cy = h / 2 + k * gap * Math.cos(angle);
      page.drawText(mark, {
        x: cx - (tw / 2) * Math.cos(angle) + (size / 2) * Math.sin(angle),
        y: cy - (tw / 2) * Math.sin(angle) - (size / 2) * Math.cos(angle),
        size,
        font,
        color: grey,
        opacity: 0.15,
        rotate: degrees((angle * 180) / Math.PI),
      });
    }
    // small footer line
    let fs = 6.5;
    while (fs > 4 && font.widthOfTextAtSize(footer, fs) > w - 24) fs -= 0.25;
    page.drawText(footer, { x: 12, y: 8, size: fs, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.6 });
  }

  doc.setProducer(`${brand} (licensed copy ${shortId})`);
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
