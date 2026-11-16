// =====================================================================
//  PDF → WebP PAGES (server only) — done ONCE per uploaded PDF
//  Each page is drawn with pdf.js on a server canvas (@napi-rs/canvas, no
//  system libraries needed) at 1400 px wide and saved as a compressed WebP in
//  the PRIVATE bucket 'reader-pages':  <file id>/v<version>/<page>.webp
//  The admin's browser asks for a few pages at a time (progress bar, no
//  time-outs). The original PDF stays private in 'materials'.
//  Students' browsers later get only 60-second signed links to single pages;
//  their personal watermark is drawn on top in the browser (no per-view work).
// =====================================================================
import "server-only";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_WIDTH = 1400; // px — sharp on phones and laptops
export const WEBP_QUALITY = 75; // ≈ 60–200 KB per page of text
export const PAGES_BUCKET = "reader-pages";
export const pagePath = (fileId: string, version: number, page: number) => `${fileId}/v${version}/${page}.webp`;

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type Napi = typeof import("@napi-rs/canvas");
let libs: Promise<{ pdfjs: PdfJs; napi: Napi }> | null = null;

/** pdf.js + the server canvas, loaded once per server. */
function load() {
  libs ??= (async () => {
    const napi = await import("@napi-rs/canvas");
    // pdf.js expects these browser classes
    const g = globalThis as Record<string, unknown>;
    g.DOMMatrix ??= napi.DOMMatrix;
    g.Path2D ??= napi.Path2D;
    g.ImageData ??= napi.ImageData;
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    return { pdfjs, napi };
  })();
  return libs;
}

/** Canvases pdf.js makes for itself (patterns, masks…) */
function canvasFactory(napi: Napi) {
  return class {
    create(w: number, h: number) {
      const canvas = napi.createCanvas(Math.max(1, w), Math.max(1, h));
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(c: { canvas: { width: number; height: number } }, w: number, h: number) {
      c.canvas.width = w;
      c.canvas.height = h;
    }
    destroy(c: { canvas: { width: number; height: number } | null; context: unknown }) {
      if (c.canvas) {
        c.canvas.width = 0;
        c.canvas.height = 0;
      }
      c.canvas = null;
      c.context = null;
    }
  };
}

export type OpenPdf = { pages: number; render: (page: number) => Promise<Buffer>; close: () => Promise<void> };

/** Open a PDF (bytes) for page-by-page WebP rendering. Throws for broken / password-protected PDFs. */
export async function openPdf(bytes: Uint8Array): Promise<OpenPdf> {
  const { pdfjs, napi } = await load();
  const fonts = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep;
  const cmaps = path.join(process.cwd(), "node_modules", "pdfjs-dist", "cmaps") + path.sep;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), // pdf.js takes ownership of the buffer
    CanvasFactory: canvasFactory(napi),
    standardFontDataUrl: fonts,
    cMapUrl: cmaps,
    cMapPacked: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  } as Parameters<PdfJs["getDocument"]>[0]).promise;

  return {
    pages: doc.numPages,
    async render(n: number) {
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: PAGE_WIDTH / base.width });
        const canvas = napi.createCanvas(Math.round(vp.width), Math.round(vp.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp } as Parameters<typeof page.render>[0]).promise;
        return await canvas.encode("webp", WEBP_QUALITY);
      } finally {
        page.cleanup();
      }
    },
    close: () => doc.destroy(),
  };
}

/** Remove every stored page picture of a file (all versions, or all except `keep`). */
export async function removePages(db: SupabaseClient, fileId: string, keepVersion?: number) {
  const { data: folders } = await db.storage.from(PAGES_BUCKET).list(fileId, { limit: 1000 });
  for (const folder of folders ?? []) {
    if (keepVersion !== undefined && folder.name === `v${keepVersion}`) continue;
    for (;;) {
      const { data: items } = await db.storage.from(PAGES_BUCKET).list(`${fileId}/${folder.name}`, { limit: 1000 });
      if (!items?.length) break;
      await db.storage.from(PAGES_BUCKET).remove(items.map((i) => `${fileId}/${folder.name}/${i.name}`));
      if (items.length < 1000) break;
    }
  }
}
