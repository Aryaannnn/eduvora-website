// Shared rules for product files (used by the browser AND the server)
import { siteConfig } from "@/config/site";

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
};

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
