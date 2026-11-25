"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSearchConsoleCode } from "@/app/admin/actions";
import { SearchIcon } from "../Icons";
import { Notice } from "./ui";

/** Admin → Settings → the Google Search Console "HTML tag" verification code. */
export default function SearchConsoleCard({ initial, setupMissing }: { initial: string; setupMissing: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (value: string) =>
    start(async () => {
      const res = await saveSearchConsoleCode(value);
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error });
      if (res.ok) {
        if (!value.trim()) setCode("");
        router.refresh();
      }
    });

  return (
    <section id="search-console" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><SearchIcon className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Google Search Console</h2>
          <p className="text-sm text-slate-500">
            Proves to Google that you own this website. In Search Console: add the website → choose <strong>HTML tag</strong> → copy the code (or the whole
            <code className="mx-1 rounded bg-slate-100 px-1 text-xs">&lt;meta name=&quot;google-site-verification&quot; …&gt;</code> tag), paste it here, save, then click
            <strong> Verify</strong> in Search Console. Then submit <code className="rounded bg-slate-100 px-1 text-xs">sitemap.xml</code> there.
          </p>
        </div>
      </div>
      {setupMissing ? (
        <div className="mt-4"><Notice kind="error">Run supabase/search-console.sql in Supabase → SQL Editor first.</Notice></div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save(code);
          }}
        >
          <label className="sr-only" htmlFor="gsv-code">Google verification code</label>
          <input id="gsv-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={300} placeholder="e.g. AbC1dEf2GhI3… or the whole <meta …> tag" className="input flex-1 font-mono text-sm" autoComplete="off" spellCheck={false} />
          <button type="submit" disabled={pending} className="btn-primary !px-5 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          {initial && <button type="button" disabled={pending} onClick={() => save("")} className="btn-light !px-4 disabled:opacity-60">Remove</button>}
        </form>
      )}
      {msg && <div className="mt-3"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
    </section>
  );
}
