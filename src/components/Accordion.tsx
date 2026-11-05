"use client";

import { useState } from "react";
import { ChevronDownIcon } from "./Icons";

// Smooth open/close question list (used for FAQs).
export default function Accordion({ items, defaultOpen = 0 }: { items: { q: string; a: string }[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={`rounded-2xl border transition-colors ${isOpen ? "border-brand-200 bg-brand-50/50" : "border-slate-200 bg-white"}`}>
            <h3>
              <button
                type="button"
                id={`acc-btn-${i}`}
                aria-expanded={isOpen}
                aria-controls={`acc-panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold text-slate-900"
              >
                {item.q}
                <ChevronDownIcon className={`h-5 w-5 shrink-0 text-brand-600 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
            </h3>
            <div
              id={`acc-panel-${i}`}
              role="region"
              aria-labelledby={`acc-btn-${i}`}
              className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 leading-relaxed text-slate-600">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
