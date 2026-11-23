"use client";

// =====================================================================
//  ADMIN → SETTINGS → STORAGE & DATABASE
//  Space per kind (originals, watermarked copies, reader page pictures,
//  images, other) + database size, with a warning at 80% of the plan.
//  "Find files to clean up" lists what could go; NOTHING is deleted until
//  you tick items and confirm. Automatic (daily): watermarked copies older
//  than 24 hours, reader page pictures (reader off) and old logs.
// =====================================================================
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteStorageItems, hashNextFiles, scanStorage } from "@/app/admin/storage-actions";
import { siteConfig } from "@/config/site";
import { formatBytes } from "@/lib/product-files";
import type { CleanupItem } from "@/lib/storage-maintenance";

export type StorageKind = { kind: string; files: number | null; bytes: number };

const KIND_LABEL: Record<string, string> = {
  originals: "Original product files (PDF / ZIP)",
  watermarked: "Watermarked copies (kept 24 hours)",
  reader_pages: "Reader page pictures (reader is off)",
  images: "Images",
  other: "Other files (invoices, signature…)",
};
const REASON_LABEL: Record<string, string> = {
  duplicate: "Duplicate PDFs (same file stored twice — products are pointed to one copy first)",
  zip_unused: "ZIP files no product uses",
  orphan_original: "Files left behind (replaced / deleted, not used by any product)",
  old_copy: "Watermarked copies older than 24 hours",
  orphan_copy: "Watermarked copies the website no longer uses",
  reader_page: "Reader page pictures (the in-website reader is switched off)",
};
const ORDER = ["duplicate", "zip_unused", "orphan_original", "old_copy", "orphan_copy", "reader_page"];
const keyOf = (i: CleanupItem) => `${i.bucket}:${i.path}`;

export default function StorageCard({ kinds, setupMissing }: { kinds: StorageKind[] | null; setupMissing: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<CleanupItem[] | null>(null);
  const [unhashed, setUnhashed] = useState(0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"" | "scan" | "hash" | "delete">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [hashLeft, setHashLeft] = useState<number | null>(null);

  const storageLimit = siteConfig.uploads.storageLimitGB * 1024 ** 3;
  const dbLimit = siteConfig.uploads.databaseLimitMB * 1024 ** 2;
  const files = (kinds ?? []).filter((k) => k.kind !== "database");
  const used = files.reduce((n, k) => n + Number(k.bytes), 0);
  const dbBytes = Number(kinds?.find((k) => k.kind === "database")?.bytes ?? 0);
  const pctStorage = Math.round((used / storageLimit) * 1000) / 10;
  const pctDb = Math.round((dbBytes / dbLimit) * 1000) / 10;

  const groups = useMemo(() => ORDER.map((r) => ({ reason: r, list: (items ?? []).filter((i) => i.reason === r) })).filter((g) => g.list.length), [items]);
  const tickedBytes = (items ?? []).filter((i) => ticked.has(keyOf(i))).reduce((n, i) => n + i.bytes, 0);

  async function scan() {
    setBusy("scan");
    setMsg(null);
    const r = await scanStorage();
    setBusy("");
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setItems(r.data!.items);
    setUnhashed(r.data!.unhashed);
    setTicked(new Set(r.data!.items.map(keyOf))); // everything ticked — untick what you want to keep
  }

  async function fingerprint() {
    setBusy("hash");
    setMsg(null);
    for (let round = 0; round < 400; round++) {
      const r = await hashNextFiles();
      if (!r.ok) {
        setBusy("");
        return setMsg({ kind: "error", text: r.error });
      }
      setHashLeft(r.data!.remaining);
      if (r.data!.remaining === 0 || r.data!.done === 0) break;
    }
    setBusy("");
    await scan();
  }

  async function remove() {
    const list = (items ?? []).filter((i) => ticked.has(keyOf(i)));
    if (!list.length) return;
    const counts = ORDER.map((r) => [r, list.filter((i) => i.reason === r).length] as const).filter(([, n]) => n);
    if (!confirm(`Delete ${list.length} file${list.length === 1 ? "" : "s"} (${formatBytes(tickedBytes)})?\n\n${counts.map(([r, n]) => `• ${n} × ${REASON_LABEL[r]}`).join("\n")}\n\nThis can't be undone. Products and students' access are not affected; duplicates are pointed to the copy that is kept first.`)) return;
    setBusy("delete");
    const r = await deleteStorageItems(list.map(keyOf));
    setBusy("");
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({ kind: "ok", text: `Removed ${r.data!.removed} file${r.data!.removed === 1 ? "" : "s"} — ${formatBytes(r.data!.bytes)} saved.` });
    setItems(null);
    setTicked(new Set());
    router.refresh();
  }

  const toggleGroup = (list: CleanupItem[], on: boolean) =>
    setTicked((t) => {
      const n = new Set(t);
      list.forEach((i) => (on ? n.add(keyOf(i)) : n.delete(keyOf(i))));
      return n;
    });

  return (
    <section className="card mb-8 p-5 sm:p-6" aria-labelledby="storage-title">
      <h2 id="storage-title" className="text-lg font-extrabold text-slate-900">🗄️ Storage &amp; database</h2>
      {setupMissing || !kinds ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">Run <strong>supabase/storage-cleanup.sql</strong> in Supabase → SQL Editor to see the report and clean up.</p>
      ) : (
        <>
          <Meter label="File storage" used={used} limit={storageLimit} pct={pctStorage} limitText={`${siteConfig.uploads.storageLimitGB} GB`} />
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {["originals", "watermarked", "reader_pages", "images", "other"].map((k) => {
              const row = files.find((f) => f.kind === k);
              return (
                <li key={k} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">{KIND_LABEL[k]}</span>
                  <span className="shrink-0 font-semibold text-slate-900">{formatBytes(Number(row?.bytes ?? 0))}{row?.files ? <span className="ml-1 text-xs font-normal text-slate-500">· {row.files}</span> : null}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5"><Meter label="Database" used={dbBytes} limit={dbLimit} pct={pctDb} limitText={`${siteConfig.uploads.databaseLimitMB} MB`} /></div>
          <p className="mt-3 text-xs text-slate-500">
            Automatic every day: watermarked copies older than 24 hours, reader page pictures, email / download / view logs older than 90 days and activity log entries older than 1 year. Payments and invoices are never deleted.
            Plan limits: src/config/site.ts → uploads.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void scan()} disabled={!!busy} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-60">{busy === "scan" ? "Scanning…" : "Find files to clean up"}</button>
            {items && unhashed > 0 && (
              <button type="button" onClick={() => void fingerprint()} disabled={!!busy} className="btn-light !px-4 !py-2 text-sm disabled:opacity-60">
                {busy === "hash" ? `Checking PDFs… ${hashLeft ?? unhashed} left` : `Check ${unhashed} PDF${unhashed === 1 ? "" : "s"} for duplicates`}
              </button>
            )}
          </div>
          {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{msg.text}</p>}

          {items && (
            <div className="mt-4">
              {groups.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ Nothing to clean up.{unhashed > 0 ? " (Check the PDFs for duplicates too.)" : ""}</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {groups.map((g) => {
                      const size = g.list.reduce((n, i) => n + i.bytes, 0);
                      const all = g.list.every((i) => ticked.has(keyOf(i)));
                      return (
                        <details key={g.reason} className="rounded-xl ring-1 ring-slate-200">
                          <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                            <input type="checkbox" checked={all} onChange={(e) => toggleGroup(g.list, e.target.checked)} onClick={(e) => e.stopPropagation()} aria-label={`Tick all: ${REASON_LABEL[g.reason]}`} />
                            <span className="flex-1 font-semibold text-slate-800">{REASON_LABEL[g.reason]}</span>
                            <span className="text-xs font-bold text-slate-600">{g.list.length} · {formatBytes(size)}</span>
                          </summary>
                          <ul className="max-h-64 overflow-y-auto border-t border-slate-100 px-3 py-2 text-xs">
                            {g.list.map((i) => (
                              <li key={keyOf(i)} className="flex items-center gap-2 py-1">
                                <input type="checkbox" checked={ticked.has(keyOf(i))} onChange={() => toggleGroup([i], !ticked.has(keyOf(i)))} aria-label={`Tick ${i.path}`} />
                                <span className="min-w-0 flex-1 truncate text-slate-600" title={i.path}>{i.detail || i.path}<span className="text-slate-400"> — {i.path}</span></span>
                                <span className="shrink-0 font-semibold text-slate-700">{formatBytes(i.bytes)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => void remove()} disabled={!!busy || ticked.size === 0} className="btn-primary mt-4 !bg-red-600 !px-4 !py-2 text-sm hover:!bg-red-700 disabled:opacity-50">
                    {busy === "delete" ? "Deleting…" : `Delete ${ticked.size} ticked (${formatBytes(tickedBytes)})`}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Meter({ label, used, limit, pct, limitText }: { label: string; used: number; limit: number; pct: number; limitText: string }) {
  const tone = pct >= 90 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-semibold text-slate-700">{label}</p>
        <p className="text-slate-600"><strong className="text-slate-900">{formatBytes(used)}</strong> of {limitText} ({pct}%)</p>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }} /></div>
      {pct >= 80 && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          ⚠️ {label} is at {pct}% of your plan ({formatBytes(limit)}). Clean up below or upgrade your Supabase plan.
        </p>
      )}
    </div>
  );
}
