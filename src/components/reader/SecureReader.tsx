"use client";

// =====================================================================
//  SECURE READER (browser)
//  • Each page is fetched from /api/reader/<file>/<page> (one watermarked page,
//    never the original file) and drawn on a <canvas> with pdf.js — no text
//    layer, so nothing can be selected or copied.
//  • No download / print / save buttons. Right-click, Ctrl/⌘ + S, P, C, A, U, X
//    are blocked, and printing shows a blank page.
//  • When the tab or window isn't active, the pages are blurred.
//  • The reading token is renewed every few minutes (access checked again).
//  Note: no website can fully stop photos of the screen — that's why every page
//  carries the student's name, phone, email and the time.
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

type Props = { fileId: string; title: string; pages: number; token: string; expiresAt: number; reader: string };

export default function SecureReader({ fileId, title, pages, token: firstToken, expiresAt: firstExpiry, reader }: Props) {
  const tokenRef = useRef({ token: firstToken, expiresAt: firstExpiry });
  const [active, setActive] = useState(true); // false → blurred
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);

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

  const getPage = useCallback(
    async (n: number): Promise<ArrayBuffer> => {
      if (tokenRef.current.expiresAt - Date.now() < 15_000) await refresh();
      let res = await fetch(`/api/reader/${fileId}/${n}?t=${encodeURIComponent(tokenRef.current.token)}`, { cache: "no-store" });
      if (res.status === 401 && (await refresh())) {
        res = await fetch(`/api/reader/${fileId}/${n}?t=${encodeURIComponent(tokenRef.current.token)}`, { cache: "no-store" });
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "This page couldn't be loaded.");
      }
      return res.arrayBuffer();
    },
    [fileId, refresh],
  );

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
            <Page key={i + 1} n={i + 1} zoom={zoom} getPage={getPage} onVisible={setCurrent} />
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

/** One page: loads when it comes near the screen, drawn on a canvas. */
function Page({ n, zoom, getPage, onVisible }: { n: number; zoom: number; getPage: (n: number) => Promise<ArrayBuffer>; onVisible: (n: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const data = useRef<ArrayBuffer | null>(null);
  const [near, setNear] = useState(n <= 2);
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "error">("waiting");
  const [ratio, setRatio] = useState(1.414); // A4 until we know
  const [msg, setMsg] = useState("");

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
      { rootMargin: "800px 0px", threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n, onVisible]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    (async () => {
      try {
        if (!data.current) {
          setState("loading");
          data.current = await getPage(n);
        }
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(data.current.slice(0)), isEvalSupported: false }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const width = Math.min(box.current?.parentElement?.clientWidth ?? 800, 900) * zoom;
        const scale = width / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: scale * dpr });
        const c = canvas.current;
        if (!c || cancelled) return void doc.destroy();
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        c.style.width = `${Math.floor(vp.width / dpr)}px`;
        c.style.height = `${Math.floor(vp.height / dpr)}px`;
        setRatio(base.height / base.width);
        await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        await doc.destroy();
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
  }, [near, zoom, n, getPage]);

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
        <div className="grid w-[min(100%,900px)] place-items-center rounded bg-white text-sm text-slate-400 ring-1 ring-slate-200" style={{ aspectRatio: `1 / ${ratio}`, width: "min(90vw, 900px)" }}>
          {state === "error" ? <span className="px-4 text-center text-red-700">Page {n}: {msg} <button type="button" onClick={() => { setState("waiting"); data.current = null; setNear(false); setTimeout(() => setNear(true), 0); }} className="underline">Try again</button></span> : `Page ${n}…`}
        </div>
      )}
    </div>
  );
}
