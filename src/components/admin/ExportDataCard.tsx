"use client";

import { useState } from "react";
import { Spinner } from "../Spinner";
import { DownloadIcon } from "../Icons";
import { Notice } from "./ui";

/** Admin → Settings → "Export all data" (ZIP of CSV files, admins only — checked on the server). */
export default function ExportDataCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/export", { cache: "no-store" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Export failed. Please try again.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "eduvora-export.zip";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="export" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><DownloadIcon className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Export all data</h2>
            <p className="text-sm text-slate-500">
              Download every table (students, products, purchases, bookings, tests, reviews, enquiries, predictions and more) as a ZIP of CSV files for Excel or Google Sheets. It contains personal data — keep it private.
            </p>
          </div>
        </div>
        <button type="button" onClick={download} disabled={busy} className="btn-primary shrink-0 disabled:opacity-60">
          {busy ? <><Spinner /> Preparing…</> : <><DownloadIcon /> Export all data</>}
        </button>
      </div>
      {error && <div className="mt-3"><Notice kind="error">{error}</Notice></div>}
      <p className="mt-3 text-xs text-slate-500">Automatic encrypted database backups run every night on GitHub — see BACKUPS.md in the project.</p>
    </section>
  );
}
