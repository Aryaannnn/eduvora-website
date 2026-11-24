"use client";

import { useRef, useState } from "react";
import { reportFailure } from "@/lib/monitor";
import { DownloadIcon, ExternalIcon } from "../Icons";

// "Open PDF" (new browser tab, the browser's own viewer) + "Download".
// Both go to /api/files/<id>, which checks access every time and sends the
// student's PERSONAL WATERMARKED copy (never the original).
//
// Download: the page first asks the server to get the copy ready
// (POST /api/files/<id>/prepare) and shows "Preparing your copy…". A big PDF can
// take a while, and on iPhone Safari nothing visible happens in the meantime —
// students tapped again and again, which cancelled their own requests. Now the
// button waits, and a failure shows a friendly message with "Try again".
// Without JavaScript the plain link still works.
export default function PdfButtons({ fileId, name, size = "md" }: { fileId: string; name: string; size?: "md" | "sm" }) {
  const pad = size === "sm" ? "!px-3 !py-2 text-xs" : "!px-4 !py-2 text-sm";
  const [state, setState] = useState<"idle" | "preparing" | "starting">("idle");
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const busy = useRef(false);
  const href = `/api/files/${fileId}/download`;

  async function download(e?: React.MouseEvent) {
    e?.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setState("preparing");
    const started = performance.now();
    try {
      const res = await fetch(`/api/files/${fileId}/prepare?mode=download`, { method: "POST", cache: "no-store", headers: { Accept: "application/json" } });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; href?: string; message?: string; retry?: boolean; login?: string } | null;
      if (res.ok && data?.ok) {
        setState("starting");
        window.location.assign(data.href || href); // the copy is ready → the download starts at once
        setTimeout(() => setState("idle"), 4000);
        return;
      }
      if (data?.login) {
        window.location.assign(data.login);
        return;
      }
      setState("idle");
      setError({ message: data?.message || "We couldn't prepare your copy just now. Please try again.", retry: data?.retry ?? res.status >= 500 });
      // the server already reported its own failures (with the step); this only covers answers that aren't JSON (e.g. a timeout page)
      if (!data) reportFailure("pdf", "Preparing a PDF download returned no answer", undefined, { step: "prepare-response", fileId, status: res.status, ms: Math.round(performance.now() - started) }, "warning");
    } catch (err) {
      // "TypeError: Load failed" (Safari) / "Failed to fetch" (Chrome): the connection dropped,
      // the phone went to sleep or the app was switched while the copy was being prepared
      setState("idle");
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setError({ message: offline ? "You seem to be offline. Please check your internet connection and try again." : "The connection was interrupted while your copy was being prepared. Please try again.", retry: true });
      reportFailure("pdf", "Preparing a PDF download: request failed", err, {
        step: "prepare-request",
        fileId,
        ms: Math.round(performance.now() - started),
        online: !offline,
        pageVisible: document.visibilityState === "visible",
      }, "warning");
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a href={`/api/files/${fileId}/open`} target="_blank" rel="noopener noreferrer" className={`btn-primary ${pad}`} aria-label={`Open ${name} (PDF) in a new tab`}>
          <ExternalIcon className="h-4 w-4" /> Open PDF
        </a>
        <a href={href} onClick={(e) => void download(e)} aria-disabled={state !== "idle"} className={`btn-light ${pad} ${state !== "idle" ? "pointer-events-none opacity-80" : ""}`} aria-label={`Download ${name} (PDF)`}>
          {state === "idle" ? <DownloadIcon className="h-4 w-4" /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
          {state === "preparing" ? "Preparing your copy…" : state === "starting" ? "Starting download…" : "Download"}
        </a>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{state === "preparing" ? `Preparing your copy of ${name}. Large files can take up to a minute.` : ""}</p>
      {state === "preparing" && <p className="text-xs text-slate-500">Adding your name to every page — large files can take up to a minute.</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200">
          <span className="min-w-0 flex-1">{error.message}</span>
          {error.retry && (
            <button type="button" onClick={() => void download()} className="min-h-11 rounded-lg bg-white px-3 font-bold text-red-700 ring-1 ring-red-300 hover:bg-red-100 sm:min-h-8">
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
