"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, WhatsAppIcon } from "../Icons";

/** Referral code + link with Copy and "Share on WhatsApp". */
export default function ReferShare({ code, link, message }: { code: string; link: string; message: string }) {
  const [copied, setCopied] = useState<"" | "code" | "link">("");

  async function copy(text: string, what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      prompt("Copy this:", text);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your referral code</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-2xl font-extrabold tracking-widest text-brand-700">{code}</p>
        <button type="button" onClick={() => copy(code, "code")} className="btn-light !px-3 !py-1.5 text-xs">
          {copied === "code" ? <><CheckIcon className="h-3.5 w-3.5" /> Copied</> : <><CopyIcon className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Your link</p>
      <div className="mt-1 flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="input !py-2 text-sm" aria-label="Your referral link" />
        <button type="button" onClick={() => copy(link, "link")} className="btn-light shrink-0 !px-3 !py-2 text-xs">
          {copied === "link" ? "Copied" : "Copy"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-4 w-full !bg-[#25D366] !py-3 hover:!bg-[#1ebe5b]"
      >
        <WhatsAppIcon className="h-5 w-5" /> Share on WhatsApp
      </a>
    </div>
  );
}
