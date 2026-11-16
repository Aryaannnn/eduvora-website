"use client";

// =====================================================================
//  SECURE READER (browser)
//  FAST mode ("images") — the PDF was turned into WebP pictures once, when the
//  admin uploaded it:
//    • only the page being read + the next page are requested, through
//      60-second signed links the server makes after checking access
//    • the student's watermark (name · phone · email · date/time) is drawn ON
//      TOP of each page here, in the browser — no image work on the server
//    • pages already opened stay in memory → instant when you scroll back or zoom
//  FALLBACK mode ("pdf") — for files not prepared yet: one server-watermarked
//  page at a time, drawn with pdf.js.
//  Both: drawn on a <canvas> (nothing to select or copy), no download / print /
//  save buttons, right-click and Ctrl/⌘ + S, P, C, A, U, X blocked, printing
//  blank, pages blurred when the tab or window isn't active.
//  Note: no website can stop photos of the screen — that's why every page shows
//  the student's details and every page view is logged.
// =====================================================================
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, LockIcon } from "../Icons";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs() {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"; // copied from pdfjs-dist (scripts/copy-pdf-worker.mjs)
    return m;
  });
  return pdfjsPromise;
}

const NOTE = "This material is for your personal use only. Sharing or screenshots are traceable to your account.";
const ZOOMS = [1, 1.25, 1.5, 2];

type Watermark = { name: string; phone: string; email: string };
type Props = {
  fileId: string; title: string; pages: number; token: string; expiresAt: number; reader: string;
  mode?: "images" | "pdf";
  watermark: Watermark;
};
/** What a page needs to draw itself */
type Source = { kind: "image"; img: HTMLImageElement } | { kind: "pdf"; data: ArrayBuffer };

const istNow = () =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date()) + " IST";

/** The student's watermark over the whole page: light, diagonal, repeating + a footer line. */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, wm: Watermark) {
  const line = [wm.name, wm.phone, wm.email, istNow()].filter(Boolean).join("  ·  ");
  const size = Math.max(11, Math.round(w / 62));
  ctx.save();
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "rgba(55, 65, 85, 0.15)";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(line).width;
  const stepX = tw + size * 5;
  const stepY = size * 8;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  const reach = Math.hypot(w, h);
  let row = 0;
  for (let y = -reach; y <= reach; y += stepY, row++) {
    for (let x = -reach + (row % 2) * (stepX / 2); x <= reach; x += stepX) ctx.fillText(line, x, y);
  }
  ctx.restore();
  // footer
  const fs = Math.max(10, Math.round(w / 95));
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(0, h - fs * 2.4, w, fs * 2.4);
  ctx.font = `700 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "rgba(55, 65, 85, 0.85)";
  ctx.textBaseline = "middle";
  ctx.fillText(`Licensed to ${line} · Personal use only — sharing or screenshots are traceable`, fs, h - fs * 1.2, w - fs * 2);
  ctx.restore();
}

export default function SecureReader({ fileId, title, pages, token: firstToken, expiresAt: firstExpiry, reader, mode = "pdf", watermark }: Props) {
  const tokenRef = useRef({ token: firstToken, expiresAt: firstExpiry });
  const [active, setActive] = useState(true); // false → blurred
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  // Pages already loaded (kept in memory only — never saved on the device)
  const cache = useRef(new Map<number, Promise<Source>>());

  // ---- keep the reading token fresh (access is checked again on the server) ----
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/reader/${fileId}/token`, { method: "POST", cache: "no-store" }).catch(() => null);
    if (!res) return false;
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Your access to this file has ended.");
      return false;
    }
    tokenRef.current = (await res.json()) as { token: string; expiresAt: number };
    return true;
  }, [fileId]);
  useEffect(() => {
    const t = setInterval(() => {
      if (tokenRef.current.expiresAt - Date.now() < 90_000) void refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [refresh]);
  const freshToken = useCallback(async () => {
    if (tokenRef.current.expiresAt - Date.now() < 15_000) await refresh();
    return tokenRef.current.token;
  }, [refresh]);

  // ---- blur when the tab/window is not active ----
  useEffect(() => {
    const update = () => setActive(document.visibilityState === "visible" && document.hasFocus());
    update();
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // ---- no right-click, copy, save, print, select-all, view-source ----
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "c", "a", "u", "x"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (k === "printscreen") setActive(false); // blur right away
    };
    document.addEventListener("contextmenu", stop);
    document.addEventListener("copy", stop);
    document.addEventListener("cut", stop);
    document.addEventListener("dragstart", stop);
    document.addEventListener("selectstart", stop);
    window.addEventListener("keydown", keys, true);
    window.addEventListener("keyup", keys, true);
    window.addEventListener("beforeprint", stop);
    return () => {
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("copy", stop);
      document.removeEventListener("cut", stop);
      document.removeEventListener("dragstart", stop);
      document.removeEventListener("selectstart", stop);
      window.removeEventListener("keydown", keys, true);
      window.removeEventListener("keyup", keys, true);
      window.removeEventListener("beforeprint", stop);
    };
  }, []);

  // ---- FAST mode: signed links for a page (+ the next one), pictures cached in memory ----
  const loadImages = useCallback(
    async (wanted: number[]) => {
      const todo = wanted.filter((n) => n >= 1 && n <= pages && !cache.current.has(n));
      if (todo.length === 0) return;
      const request = (async () => {
        const call = async () =>
          fetch(`/api/reader/${fileId}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ t: await freshToken(), pages: todo }) });
        let res = await call();
        if (res.status === 401 && (await refresh())) res = await call();
        const d = (await res.json().catch(() => ({}))) as { urls?: Record<string, string>; error?: string };
        if (!res.ok || !d.urls) throw new Error(d.error ?? "This page couldn't be loaded.");
        return d.urls;
      })();
      for (const n of todo) {
        const p = request.then(
          (urls) =>
            new Promise<Source>((resolve, reject) => {
              const url = urls[n];
              if (!url) return reject(new Error("This page couldn't be loaded."));
              const img = new Image();
              img.decoding = "async";
              img.referrerPolicy = "no-referrer";
              img.onload = () => resolve({ kind: "image", img });
              img.onerror = () => reject(new Error("This page couldn't be loaded. Please try again."));
              img.src = url; // a 60-second link — used once, then the picture stays in memory
            }),
        );
        p.catch(() => cache.current.delete(n)); // failed → try again next time
        cache.current.set(n, p);
      }
    },
    [fileId, pages, freshToken, refresh],
  );

  // ---- FALLBACK mode: one server-watermarked page as a tiny PDF ----
  const loadPdfPage = useCallback(
    async (n: number): Promise<Source> => {
      const get = async () => fetch(`/api/reader/${fileId}/${n}?t=${encodeURIComponent(await freshToken())}`, { cache: "no-store" });
      let res = await get();
      if (res.status === 401 && (await refresh())) res = await get();
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "This page couldn't be loaded.");
      }
      return { kind: "pdf", data: await res.arrayBuffer() };
    },
    [fileId, freshToken, refresh],
  );

  /** The page to draw (from memory if already loaded). FAST mode also fetches the next page ahead. */
  const getSource = useCallback(
    (n: number): Promise<Source> => {
      if (mode === "images") {
        void loadImages([n, n + 1]);
        return cache.current.get(n)!;
      }
      let p = cache.current.get(n);
      if (!p) {
        p = loadPdfPage(n);
        p.catch(() => cache.current.delete(n));
        cache.current.set(n, p);
      }
      return p;
    },
    [mode, loadImages, loadPdfPage],
  );

  // Reading page n → get n + 1 ready too (FAST mode)
  useEffect(() => {
    if (mode === "images") void loadImages([current, current + 1]);
  }, [current, mode, loadImages]);

  return (
    <div className="secure-reader select-none" style={{ WebkitTouchCallout: "none" }}>
      {/* Printing shows nothing */}
      <style>{`@media print { body * { visibility: hidden !important; } body::after { content: "Printing is not allowed."; visibility: visible; } }`}</style>

      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/courses" className="btn-light !px-3 !py-2 text-sm" aria-label="Back to My Courses"><ChevronLeftIcon className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Page {current} of {pages} · Licensed to {reader}</p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} className="btn-light !px-3 !py-2 text-sm disabled:opacity-40" aria-label="Zoom out">−</button>
            <span className="w-12 text-center text-sm font-bold tabular-nums text-slate-700">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} className="btn-light !px-3 !py-2 text-sm disabled:opacity-40" aria-label="Zoom in">+</button>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-800">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {NOTE}
        </p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800 ring-1 ring-red-200">{error} <button type="button" onClick={() => location.reload()} className="underline">Reload</button></p>}

      <div className="relative">
        <div className={`mx-auto space-y-4 overflow-x-auto transition ${active ? "" : "pointer-events-none blur-xl"}`} aria-hidden={!active}>
          {Array.from({ length: pages }, (_, i) => (
            <Page key={i + 1} n={i + 1} zoom={zoom} lazyMargin={mode === "images" ? "300px 0px" : "800px 0px"} getSource={getSource} watermark={mode === "images" ? watermark : null} onVisible={setCurrent} />
          ))}
        </div>
        {!active && (
          <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center p-6">
            <p className="max-w-sm rounded-2xl bg-white/95 p-5 text-center text-sm font-semibold text-slate-800 shadow-2xl ring-1 ring-slate-200">
              🔒 {NOTE}
              <span className="mt-2 block text-xs font-normal text-slate-500">Click or tap here to keep reading.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** One page: loads only when it comes near the screen, drawn on a canvas (+ the watermark in FAST mode). */
function Page({ n, zoom, lazyMargin, getSource, watermark, onVisible }: {
  n: number; zoom: number; lazyMargin: string; getSource: (n: number) => Promise<Source>; watermark: Watermark | null; onVisible: (n: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(n === 1);
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "error">("waiting");
  const [ratio, setRatio] = useState(1.414); // A4 until we know
  const [msg, setMsg] = useState("");
  const [attempt, setAttempt] = useState(0);
  // The space available (0 while the page is still being streamed in) — redraws on resize / rotation
  const [space, setSpace] = useState(0);
  useEffect(() => {
    const parent = box.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => setSpace(Math.round(parent.clientWidth / 8) * 8)); // ignore tiny changes
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setNear(true);
          if (e.intersectionRatio > 0.4) onVisible(n);
        }
      },
      { rootMargin: lazyMargin, threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n, onVisible, lazyMargin]);

  useEffect(() => {
    if (!near || space === 0) return;
    let cancelled = false;
    (async () => {
      try {
        setState((s) => (s === "ready" ? s : "loading"));
        const src = await getSource(n);
        const c = canvas.current;
        if (!c || cancelled) return;
        const cssWidth = Math.min(space, 900) * zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (src.kind === "image") {
          const r = src.img.naturalHeight / src.img.naturalWidth;
          c.width = Math.round(cssWidth * dpr);
          c.height = Math.round(cssWidth * r * dpr);
          c.style.width = `${Math.round(cssWidth)}px`;
          c.style.height = `${Math.round(cssWidth * r)}px`;
          const ctx = c.getContext("2d")!;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(src.img, 0, 0, c.width, c.height);
          if (watermark) drawWatermark(ctx, c.width, c.height, watermark);
          setRatio(r);
        } else {
          const pdfjs = await loadPdfJs();
          const doc = await pdfjs.getDocument({ data: new Uint8Array(src.data.slice(0)), isEvalSupported: false }).promise;
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (cssWidth / base.width) * dpr });
          if (cancelled) return void doc.destroy();
          c.width = Math.floor(vp.width);
          c.height = Math.floor(vp.height);
          c.style.width = `${Math.floor(vp.width / dpr)}px`;
          c.style.height = `${Math.floor(vp.height / dpr)}px`;
          setRatio(base.height / base.width);
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          await doc.destroy();
        }
        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setMsg((e as Error).message);
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [near, zoom, n, getSource, watermark, attempt, space]);

  return (
    <div ref={box} className="relative mx-auto w-fit max-w-none">
      <canvas
        ref={canvas}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        className={`block bg-white shadow-md ring-1 ring-slate-200 ${state === "ready" ? "" : "hidden"}`}
        aria-label={`Page ${n}`}
        role="img"
      />
      {state !== "ready" && (
        <div className="grid place-items-center rounded bg-white text-sm text-slate-400 ring-1 ring-slate-200" style={{ aspectRatio: `1 / ${ratio}`, width: `min(90vw, ${Math.round(900 * zoom)}px)` }}>
          {state === "error" ? (
            <span className="px-4 text-center text-red-700">
              Page {n}: {msg} <button type="button" onClick={() => setAttempt((a) => a + 1)} className="underline">Try again</button>
            </span>
          ) : (
            `Page ${n}…`
          )}
        </div>
      )}
    </div>
  );
}
