"use client";

import { DownloadIcon } from "../Icons";

/** Opens the print window — choose "Save as PDF" to download. */
export default function PrintButton({ label = "Download / Print PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary !px-4 !py-2.5 text-sm">
      <DownloadIcon /> {label}
    </button>
  );
}
