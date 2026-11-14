"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveShowOriginalPrice } from "@/app/admin/actions";
import { TagIcon } from "../Icons";
import { Notice, Toggle } from "./ui";

/** Admin → Settings → show/hide the crossed-out original price and "% off" labels. Saves at once. */
export default function PriceLabelsCard({ initial, setupMissing }: { initial: boolean; setupMissing: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const change = (next: boolean) => {
    const before = show;
    setShow(next);
    start(async () => {
      const res = await saveShowOriginalPrice(next);
      if (!res.ok) setShow(before); // put the switch back
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });
  };

  return (
    <section id="price-labels" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-400/20 text-accent-700"><TagIcon className="h-6 w-6" /></span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Original price &amp; &ldquo;% off&rdquo; labels</h2>
            <p className="text-sm text-slate-500">
              The crossed-out price (<span className="line-through">₹9,999</span>) and the &ldquo;33% off&rdquo; badge on course, study-material, test and package cards and pages. Switch off to show only the real price.
            </p>
          </div>
        </div>
        {!setupMissing && (
          <div className={pending ? "pointer-events-none opacity-60" : ""} aria-busy={pending}>
            <Toggle checked={show} onChange={change} label={pending ? "Saving…" : show ? "Shown" : "Hidden"} />
          </div>
        )}
      </div>
      {setupMissing && <div className="mt-4"><Notice kind="error">Run supabase/price-labels.sql in Supabase → SQL Editor first. Until then the labels are shown.</Notice></div>}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
