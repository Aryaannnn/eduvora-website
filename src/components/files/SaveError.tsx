"use client";

import { reportFailure } from "@/lib/monitor";

// "Mark as done" / study-plan saves are small requests to the server. If the phone's
// connection drops (Safari: "TypeError: Load failed"), say so and offer "Try again" —
// never leave the tick showing something that wasn't saved.
export type SaveFailure = { message: string; again?: () => void };

/** Runs a save; a dropped connection becomes a friendly message (and a quiet Sentry note). */
export async function safeSave<T extends { ok: boolean }>(what: string, run: () => Promise<T>, extra: Record<string, string>): Promise<T | { ok: false; error: string }> {
  const started = performance.now();
  try {
    return await run();
  } catch (err) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    reportFailure("progress", `${what}: request failed`, err, { step: what, ...extra, ms: Math.round(performance.now() - started), online: !offline, pageVisible: document.visibilityState === "visible" }, "warning");
    return { ok: false, error: offline ? "You seem to be offline — not saved. Please check your internet connection." : "Couldn't save — the connection was interrupted." };
  }
}

export default function SaveError({ failure, className = "" }: { failure: SaveFailure | null; className?: string }) {
  if (!failure) return null;
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 ${className}`}>
      <span className="min-w-0 flex-1">{failure.message}</span>
      {failure.again && (
        <button type="button" onClick={failure.again} className="min-h-11 rounded-lg bg-white px-3 font-bold text-red-700 ring-1 ring-red-300 hover:bg-red-100 sm:min-h-8">
          Try again
        </button>
      )}
    </div>
  );
}
