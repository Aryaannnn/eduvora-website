// Shared rules for product files (used by the browser AND the server)
import { siteConfig } from "@/config/site";
import { isFormulaBook, isQuestionBank } from "./courses";

export type FileKind = "pdf" | "zip";
export const MAX_FILE_BYTES = siteConfig.uploads.maxFileMB * 1024 * 1024;
export const MIME: Record<FileKind, string> = { pdf: "application/pdf", zip: "application/zip" };

export type ProductFile = {
  id: string;
  product_id: string;
  display_name: string;
  file_path: string;
  file_type: FileKind;
  size_bytes: number;
  sort_order: number;
  download_count: number;
  created_at: string;
  // Fast reader (supabase/reader-pages.sql): pages turned into WebP pictures once
  page_count?: number | null;
  pages_status?: "none" | "processing" | "ready" | "failed";
  pages_done?: number;
  pages_bytes?: number;
  pages_error?: string | null;
  // Crash courses / Question Bank (supabase/courses-question-bank.sql)
  subject?: PdfSubject | null;
  chapter?: string | null;
};

/** Subjects a PDF can be filed under (crash courses and the Question Bank) */
export type PdfSubject = "physics" | "chemistry" | "mathematics" | "english_aptitude";
export type PcmSubject = Exclude<PdfSubject, "english_aptitude">;
/** Physics · Chemistry · Mathematics — the Formula Book and the Question Bank have only these */
export const PCM_SUBJECTS: { id: PcmSubject; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "mathematics", label: "Mathematics" },
];
/** Every subject a PDF can have: the crash courses also have English & Aptitude */
export const PDF_SUBJECTS: { id: PdfSubject; label: string }[] = [...PCM_SUBJECTS, { id: "english_aptitude", label: "English & Aptitude" }];
export const isPdfSubject = (s: unknown): s is PdfSubject => PDF_SUBJECTS.some((x) => x.id === s);
export const isPcmSubject = (s: unknown): s is PcmSubject => PCM_SUBJECTS.some((x) => x.id === s);
/** The subjects of one product: the crash courses have four; the Formula Book and the Question Bank three. */
export const subjectsForSlug = (slug?: string | null) => (slug && (isFormulaBook(slug) || isQuestionBank(slug)) ? PCM_SUBJECTS : PDF_SUBJECTS);
/** "physics" → "Physics", "pcm" → "PCM bundle", empty → "Other" */
export const subjectLabel = (s?: string | null) => PDF_SUBJECTS.find((x) => x.id === s)?.label ?? (s === "pcm" ? "PCM bundle" : "Other");

/** "Notes.PDF" → "pdf", "Set.zip" → "zip", anything else → null */
export function kindOf(name: string, mime = ""): FileKind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") && (!mime || mime === "application/pdf" || mime === "application/octet-stream")) return "pdf";
  if (n.endsWith(".zip") && (!mime || /zip|octet-stream/.test(mime))) return "zip";
  return null;
}

/** Friendly problem with a file, or null if it's fine */
export function checkFile(name: string, size: number, mime = ""): string | null {
  if (!kindOf(name, mime)) return `"${name}" is not a PDF or ZIP file. Only .pdf and .zip files can be uploaded.`;
  if (size <= 0) return `"${name}" is empty.`;
  if (size > MAX_FILE_BYTES) return `"${name}" is ${formatBytes(size)} — the limit is ${siteConfig.uploads.maxFileMB} MB per file. Please compress it or split it into smaller parts.`;
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** "Notes (Final).pdf" → "notes-final" */
export const slugName = (name: string) =>
  name.replace(/\.(pdf|zip)$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "file";

/** Name shown to students, from the file name */
export const niceName = (name: string) => name.replace(/\.(pdf|zip)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "File";
