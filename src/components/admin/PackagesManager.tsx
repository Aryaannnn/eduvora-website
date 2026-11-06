"use client";

// Admin → Packages: add / edit / hide counselling packages.
// Students who already bought a package keep the sessions they paid for,
// even if you change the price or sessions later.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePackage, setProductFlag, type PackageInput } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";
import { EditIcon, PlusIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminPackage = {
  id: string; title: string; description: string | null; price: number; original_price: number | null; is_active: boolean; sort_order: number;
  package_sessions: number | null; package_unlimited: boolean; details: { tagline?: string; popular?: boolean; features?: string[] } | null; sold: number;
};

const sessionsText = (p: AdminPackage) => (p.package_unlimited ? "Unlimited" : `${p.package_sessions ?? 1} session${p.package_sessions === 1 ? "" : "s"}`);

export default function PackagesManager({ packages, setupMissing }: { packages: AdminPackage[]; setupMissing: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminPackage | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { kind: "success", text: res.message ?? "Saved." } : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <>
      <AdminHeader title="Packages" subtitle="Counselling packages shown on Book a Slot and the home page. Buyers get session credits and the full predictor.">
        <button type="button" onClick={() => setEditing("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> Add package</button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/packages.sql in Supabase → SQL Editor first. It adds packages and session credits.</Notice></div>}
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {packages.map((p) => (
          <article key={p.id} className={`card flex flex-col p-5 ${p.details?.popular ? "ring-2 ring-accent-400" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold text-slate-900">{p.title}</p>
                {p.details?.tagline && <p className="text-xs text-slate-500">{p.details.tagline}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {p.details?.popular && <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-bold text-brand-950">Most Popular</span>}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.is_active ? "Shown" : "Hidden"}</span>
              </div>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {formatPrice(p.price)} {p.original_price && <span className="text-sm font-semibold text-slate-400 line-through">{formatPrice(p.original_price)}</span>}
            </p>
            <p className="text-sm font-semibold text-brand-700">{sessionsText(p)}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {(p.details?.features ?? []).map((f) => <li key={f}>{f}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Sold: <strong className="text-slate-800">{p.sold}</strong> · Order {p.sort_order}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
              <button type="button" onClick={() => setEditing(p)} className="btn-light !px-3 !py-2 text-sm"><EditIcon className="h-4 w-4" /> Edit</button>
              <Toggle checked={p.is_active} onChange={(v) => run(() => setProductFlag(p.id, "is_active", v))} label={p.is_active ? "Shown" : "Hidden"} />
            </div>
          </article>
        ))}
        {packages.length === 0 && !setupMissing && <p className="card p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">No packages yet. Click “Add package”.</p>}
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Sold packages stay in students’ payment history, so packages can’t be deleted. To stop selling one, switch it to <strong>Hidden</strong>. To give or take session credits from one student, use <strong>Admin → Students → Sessions → Adjust</strong>.
      </p>

      {editing && (
        <PackageForm
          pkg={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => run(() => savePackage(input), () => setEditing(null))}
        />
      )}
    </>
  );
}

function PackageForm({ pkg, pending, onClose, onSave }: { pkg: AdminPackage | null; pending: boolean; onClose: () => void; onSave: (v: PackageInput) => void }) {
  const [f, setF] = useState({
    title: pkg?.title ?? "",
    tagline: pkg?.details?.tagline ?? "",
    description: pkg?.description ?? "",
    price: String(pkg?.price ?? ""),
    original_price: pkg?.original_price ? String(pkg.original_price) : "",
    sessions: String(pkg?.package_sessions ?? 1),
    unlimited: pkg?.package_unlimited ?? false,
    features: (pkg?.details?.features ?? []).join("\n"),
    popular: !!pkg?.details?.popular,
    is_active: pkg?.is_active ?? true,
    sort_order: String(pkg?.sort_order ?? 0),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal title={pkg ? `Edit ${pkg.title}` : "Add package"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ id: pkg?.id, ...f });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="pk-title">Name *</Label><input id="pk-title" value={f.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="e.g. Complete" required /></div>
          <div><Label htmlFor="pk-tag">Short line</Label><input id="pk-tag" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} className="input" placeholder="e.g. Best for most students" /></div>
          <div><Label htmlFor="pk-price">Price (₹) *</Label><input id="pk-price" type="number" min={1} inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} className="input" required /></div>
          <div><Label htmlFor="pk-orig">Strike-through price (₹)</Label><input id="pk-orig" type="number" min={0} inputMode="numeric" value={f.original_price} onChange={(e) => set("original_price", e.target.value)} className="input" placeholder="optional" /></div>
          <div>
            <Label htmlFor="pk-sessions">Sessions included</Label>
            <input id="pk-sessions" type="number" min={1} max={100} inputMode="numeric" value={f.sessions} disabled={f.unlimited} onChange={(e) => set("sessions", e.target.value)} className="input disabled:bg-slate-100" />
            <div className="mt-2"><Toggle checked={f.unlimited} onChange={(v) => set("unlimited", v)} label="Unlimited (until admission)" /></div>
          </div>
          <div><Label htmlFor="pk-order">Order (lower = first)</Label><input id="pk-order" type="number" inputMode="numeric" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="input" /></div>
        </div>
        <div>
          <Label htmlFor="pk-features">What&apos;s included (one per line)</Label>
          <textarea id="pk-features" rows={5} value={f.features} onChange={(e) => set("features", e.target.value)} className="input" placeholder={"3 one-to-one counselling sessions\nFull Rank & College Predictor\nWhatsApp support until counselling ends"} />
        </div>
        <div><Label htmlFor="pk-desc">Description (shown on the invoice / emails)</Label><input id="pk-desc" value={f.description} onChange={(e) => set("description", e.target.value)} className="input" /></div>
        <div className="flex flex-wrap gap-6">
          <Toggle checked={f.popular} onChange={(v) => set("popular", v)} label="Most Popular badge" />
          <Toggle checked={f.is_active} onChange={(v) => set("is_active", v)} label="Shown on the website" />
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">Changes apply to new buyers. Students who already bought keep the sessions they paid for.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save package"}</button>
        </div>
      </form>
    </Modal>
  );
}
