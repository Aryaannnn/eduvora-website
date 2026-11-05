"use client";

import { useEffect } from "react";
import { CloseIcon } from "../Icons";

// Shared pieces for the admin screens

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><CloseIcon className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">{children}</label>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-700">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      {label}
    </label>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ${kind === "error" ? "bg-red-50 text-red-700 ring-red-200" : "bg-green-50 text-green-700 ring-green-200"}`}>
      {children}
    </p>
  );
}

export function AdminHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Pill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${on ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{on ? onLabel : offLabel}</span>;
}

/** Downloads rows as a .csv file (opens in Excel / Google Sheets) */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
