// Copies pdf.js's worker into public/pdfjs/ so the secure reader can load it from
// our own site (same version as the installed pdfjs-dist). Runs after `npm install`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
const to = join(root, "public", "pdfjs", "pdf.worker.min.mjs");
try {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log("pdf.js worker copied to public/pdfjs/");
} catch (e) {
  console.warn("Could not copy the pdf.js worker:", e.message);
}
