"use client";

import { useState } from "react";

// Courses are PDF-only (no live / recorded classes, lectures, batches or doubt sessions).
// Wrap an admin form: whatever is typed is checked, and a warning appears if a phrase
// like that comes back by mistake. It never blocks saving.
const CLAIM_RE = /live class(es)?|live batch(es)?|recorded|recording|lecture|doubt|\bbatch(es)?\b/gi;

/** the claim words in a piece of text (lower-case, no duplicates) */
export function claimWords(text: string): string[] {
  return [...new Set((text.match(CLAIM_RE) ?? []).map((w) => w.toLowerCase()))];
}

export default function ClaimWatcher({ children, initialText = "" }: { children: React.ReactNode; initialText?: string }) {
  const [words, setWords] = useState<string[]>(() => claimWords(initialText));
  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (typeof el.value !== "string") return;
    const box = e.currentTarget;
    // check every text field in this form, so the warning goes away once they are all fixed
    const all = [...box.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[type=text], input:not([type]), textarea")].map((x) => x.value).join("\n");
    setWords(claimWords(all));
  };
  return (
    <div onInput={onInput}>
      {words.length > 0 && (
        <p role="alert" className="sticky top-2 z-20 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 shadow ring-1 ring-amber-300">
          ⚠️ You typed {words.map((w) => `“${w}”`).join(", ")}. EDUVORA courses are PDF-only (no live or recorded classes, lectures, batches or doubt sessions) — please check this text before saving.
        </p>
      )}
      {children}
    </div>
  );
}
