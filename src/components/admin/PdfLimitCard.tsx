"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePdfDailyLimit } from "@/app/admin/actions";
import { CheckIcon, FileIcon } from "../Icons";
import { Label, Notice } from "./ui";

/** Admin → Settings → how many times a student may open/download each PDF per day (default 20). */
export default function PdfLimitCard({ initial }: { initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial ?? 20));
  const [saved, setSaved] = useState(String(initial ?? 20));
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section id="pdf-limit" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><FileIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">PDF downloads</h2>
          <p className="text-sm text-slate-500">Students get each PDF as their own copy, watermarked with their name, phone and email. Every open and download is logged (Admin → Products → Downloads).</p>
        </div>
      </div>
      {initial === null ? (
        <div className="mt-4"><Notice kind="error">Run supabase/pdf-downloads.sql in Supabase → SQL Editor first. Until then the limit is 20 per file per day.</Notice></div>
      ) : (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await savePdfDailyLimit(value);
              setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
              if (res.ok) { setSaved(value); router.refresh(); }
            });
          }}
        >
          <div>
            <Label htmlFor="pdf-limit-n">Opens + downloads per student, per file, per day</Label>
            <input id="pdf-limit-n" type="number" min={1} max={500} value={value} onChange={(e) => setValue(e.target.value)} className="input !w-40" />
          </div>
          {value !== saved ? (
            <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-4 w-4" /> Saved</span>
          )}
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
