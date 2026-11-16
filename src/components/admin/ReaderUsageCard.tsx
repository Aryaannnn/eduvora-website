"use client";

// Admin → Products: the fast reader at a glance
//  • this month's page views and an estimate of the data sent (to watch your
//    Supabase "egress" and Vercel limits — page pictures come from Supabase
//    Storage, not through Vercel)
//  • "Process all PDFs": turns every PDF that isn't ready yet into page pictures
import { useRouter } from "next/navigation";
import { useState } from "react";
import { listPdfsForReader } from "@/app/admin/file-actions";
import { formatBytes } from "@/lib/product-files";
import { processPdfPages } from "@/lib/process-pages-client";
import { BookIcon } from "../Icons";
import { Notice } from "./ui";

export type ReaderUsage = { views: number; bytes: number; stored: number; filesReady: number; filesWaiting: number } | null;

export default function ReaderUsageCard({ usage }: { usage: ReaderUsage }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function processAll(force: boolean) {
    if (force && !confirm("Re-process ALL PDFs? Every PDF's page pictures are made again (this can take a few minutes for big files). Students can keep reading meanwhile.")) return;
    setRunning(true);
    setMsg(null);
    const list = await listPdfsForReader();
    if (!list.ok) {
      setRunning(false);
      return setMsg({ kind: "error", text: list.error });
    }
    const todo = list.data!.files.filter((f) => force || f.status !== "ready");
    if (todo.length === 0) {
      setRunning(false);
      return setMsg({ kind: "success", text: "All PDFs are already prepared for reading." });
    }
    const failed: string[] = [];
    for (let i = 0; i < todo.length; i++) {
      const f = todo[i];
      try {
        await processPdfPages(f.id, (p) => setStatus(`File ${i + 1} of ${todo.length}: “${f.name}”${p.total ? ` — page ${p.done} of ${p.total}` : "…"}`));
      } catch (e) {
        failed.push(`“${f.name}” (${f.product}): ${(e as Error).message}`);
      }
    }
    setRunning(false);
    setStatus("");
    setMsg(
      failed.length
        ? { kind: "error", text: `${todo.length - failed.length} of ${todo.length} PDFs prepared. Problems: ${failed.join(" · ")}` }
        : { kind: "success", text: `Done — ${todo.length} PDF${todo.length === 1 ? "" : "s"} prepared for reading.` },
    );
    router.refresh();
  }

  const avg = usage && usage.views ? usage.bytes / usage.views : 0;
  return (
    <section className="card mb-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><BookIcon className="h-6 w-6" /></span>
          <div>
            <h2 className="font-extrabold text-slate-900">Online reader — this month</h2>
            {usage ? (
              <p className="text-sm text-slate-600">
                <strong>{usage.views.toLocaleString("en-IN")}</strong> page views · about <strong>{formatBytes(usage.bytes)}</strong> sent{avg ? ` (≈ ${formatBytes(avg)} per page)` : ""} · page pictures stored: {formatBytes(usage.stored)}
              </p>
            ) : (
              <p className="text-sm text-amber-700">Run supabase/reader-pages.sql in Supabase to see usage and turn on the fast reader.</p>
            )}
            {usage && (
              <p className="mt-0.5 text-xs text-slate-500">
                {usage.filesReady} PDF{usage.filesReady === 1 ? "" : "s"} ready{usage.filesWaiting ? <> · <strong className="text-amber-700">{usage.filesWaiting} not prepared yet</strong> (students get the slower reader for those)</> : null}. Pictures are sent from Supabase Storage (free plan: 5 GB a month).
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={running || !usage} onClick={() => void processAll(false)} className="btn-primary !py-2.5 text-sm disabled:opacity-60">{running ? "Processing…" : "Process all PDFs"}</button>
          <button type="button" disabled={running || !usage} onClick={() => void processAll(true)} className="btn-light !py-2.5 text-sm disabled:opacity-60" title="Make every PDF's pages again">Re-process all</button>
        </div>
      </div>
      {running && <p className="mt-3 text-sm font-semibold text-brand-700" role="status">{status || "Starting…"} — keep this page open.</p>}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
