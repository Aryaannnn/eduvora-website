"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteProduct, loadProductLinks, saveProduct, setProductFlag, type ProductInput } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";
import { EditIcon, FileIcon, PlusIcon, SearchIcon, TrashIcon } from "../Icons";
import { siteConfig } from "@/config/site";
import { formatBytes } from "@/lib/product-files";
import FilesManager from "./FilesManager";
import { AdminHeader, Label, Modal, Notice, Toggle } from "./ui";

export type AdminProduct = {
  id: string; title: string; slug: string; description: string | null; category: ProductInput["category"]; college: string | null;
  price: number; original_price: number | null; is_free: boolean; is_active: boolean; thumbnail_url: string | null;
  file_path: string | null; details: Record<string, unknown>; sort_order: number; created_at: string;
  files_count?: number; downloads?: number;
};

export type StorageInfo = { usedBytes: number | null; filesBytes: number };

const CATEGORIES: { id: ProductInput["category"]; label: string }[] = [
  { id: "crash_course", label: "Crash course" },
  { id: "study_material", label: "Study material" },
  { id: "previous_paper", label: "Previous year paper" },
  { id: "mock_test", label: "Mock / MCQ test" },
];
const catLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
const COLLEGES = ["VIT Vellore", "VIT Chennai", "VIT-AP", "VIT Bhopal"];

export default function ProductsManager({ products, storage }: { products: AdminProduct[]; storage?: StorageInfo }) {
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [college, setCollege] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const colleges = useMemo(() => [...new Set([...COLLEGES, ...products.map((p) => p.college).filter(Boolean)])] as string[], [products]);
  const shown = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (college === "all" || p.college === college) &&
      (!q || `${p.title} ${p.slug}`.toLowerCase().includes(q.toLowerCase())),
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (res.message ? { kind: "success", text: res.message } : null) : { kind: "error", text: res.error ?? "Something went wrong." });
      if (res.ok) router.refresh();
    });

  return (
    <>
      <AdminHeader title="Products" subtitle="Crash courses, study material, previous papers and mock tests. Changes show on the website immediately.">
        <button type="button" onClick={() => setEditing("new")} className="btn-primary"><PlusIcon /> Add product</button>
      </AdminHeader>

      {/* Filters */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="input !pl-9" aria-label="Search products" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={college} onChange={(e) => setCollege(e.target.value)} className="input" aria-label="Filter by college">
          <option value="all">All colleges</option>
          {colleges.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {storage && <StorageBar storage={storage} />}

      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`card overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Free</th>
              <th className="px-4 py-3">Visible</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No products match these filters.</td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.id} className={p.is_active ? "" : "bg-slate-50/70 text-slate-400"}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{p.title}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    {p.college && <span>{p.college}</span>}
                    {(p.files_count ?? (p.file_path ? 1 : 0)) > 0 && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <FileIcon className="h-3.5 w-3.5" /> {p.files_count ?? 1} file{(p.files_count ?? 1) === 1 ? "" : "s"}
                        {p.downloads ? <span className="text-slate-400">· {p.downloads} downloads</span> : null}
                      </span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-600">{catLabel(p.category)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                  {formatPrice(p.price)}
                  {p.original_price ? <span className="ml-1 text-xs font-normal text-slate-400 line-through">{formatPrice(p.original_price)}</span> : null}
                </td>
                <td className="px-4 py-3"><Toggle checked={p.is_free} onChange={(v) => run(() => setProductFlag(p.id, "is_free", v))} label="" /></td>
                <td className="px-4 py-3"><Toggle checked={p.is_active} onChange={(v) => run(() => setProductFlag(p.id, "is_active", v))} label="" /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" onClick={() => setEditing(p)} className="btn-light !px-3 !py-1.5 text-xs"><EditIcon /> Edit</button>{" "}
                  <button
                    type="button"
                    onClick={() => confirm(`Delete "${p.title}"? This can't be undone. (Products with purchases can only be hidden.)`) && run(() => deleteProduct(p.id))}
                    className="btn-light !px-3 !py-1.5 text-xs !text-red-600"
                  >
                    <TrashIcon /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Turning <strong>Free</strong> on sets the price to ₹0. Turning <strong>Visible</strong> off hides it from the website (buyers keep access).</p>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          defaultCategory={category !== "all" ? (category as ProductInput["category"]) : "study_material"}
          onClose={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setMsg({ kind: "success", text }); router.refresh(); }}
          onChanged={() => router.refresh()}
        />
      )}
    </>
  );
}

function ProductForm({ product, defaultCategory, onClose, onSaved, onChanged }: { product: AdminProduct | null; defaultCategory: ProductInput["category"]; onClose: () => void; onSaved: (msg: string) => void; onChanged: () => void }) {
  // A NEW product gets its id after the first Save — then the Files section appears
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const productId = product?.id ?? createdId;
  const [f, setF] = useState({
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    category: product?.category ?? defaultCategory,
    college: product?.college ?? "",
    price: String(product?.price ?? ""),
    original_price: product?.original_price ? String(product.original_price) : "",
    is_free: product?.is_free ?? false,
    is_active: product?.is_active ?? true,
    thumbnail_url: product?.thumbnail_url ?? "",
    sort_order: String(product?.sort_order ?? 0),
    details: JSON.stringify(product?.details ?? {}, null, 2),
  });
  const [links, setLinks] = useState<{ title: string; url: string }[] | null>(product ? null : []);
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  // Load the private class links when editing (admins read them through a secure function)
  useEffect(() => {
    if (!product) return;
    let alive = true;
    loadProductLinks(product.id).then((r) => alive && setLinks(r.ok ? r.data ?? [] : []));
    return () => {
      alive = false;
    };
  }, [product]);


  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (product && links === null) return setError("Please wait a second — links are still loading.");
    start(async () => {
      const res = await saveProduct({ ...f, id: productId ?? undefined, content_links: links ?? [] });
      if (!res.ok) return setError(res.error);
      if (!productId && res.data?.id) {
        setCreatedId(res.data.id); // keep the form open so files can be added now
        setInfo(res.message ?? "Product added — now add its files below.");
        onChanged();
      } else onSaved(res.message ?? "Saved.");
    });
  }

  return (
    <Modal title={productId ? "Edit product" : "Add product"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pf-title">Title *</Label>
            <input id="pf-title" value={f.title} onChange={(e) => set("title", e.target.value)} className="input" required />
          </div>
          <div>
            <Label htmlFor="pf-cat">Category *</Label>
            <select id="pf-cat" value={f.category} onChange={(e) => set("category", e.target.value as ProductInput["category"])} className="input">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="pf-college">College {f.category === "study_material" ? "*" : "(optional)"}</Label>
            <input id="pf-college" list="pf-colleges" value={f.college} onChange={(e) => set("college", e.target.value)} className="input" placeholder="e.g. VIT Vellore" />
            <datalist id="pf-colleges">{COLLEGES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <Label htmlFor="pf-price">Price (₹) *</Label>
            <input id="pf-price" type="number" min={0} inputMode="numeric" value={f.is_free ? "0" : f.price} disabled={f.is_free} onChange={(e) => set("price", e.target.value)} className="input disabled:bg-slate-100" />
          </div>
          <div>
            <Label htmlFor="pf-orig">Original price (₹, optional strike-through)</Label>
            <input id="pf-orig" type="number" min={0} inputMode="numeric" value={f.original_price} onChange={(e) => set("original_price", e.target.value)} className="input" />
          </div>
          <div className="flex flex-wrap gap-6 sm:col-span-2">
            <Toggle checked={f.is_free} onChange={(v) => set("is_free", v)} label="Free" />
            <Toggle checked={f.is_active} onChange={(v) => set("is_active", v)} label="Visible on website" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pf-desc">Description</Label>
            <textarea id="pf-desc" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className="input" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pf-thumb">Thumbnail image link (optional)</Label>
            <input id="pf-thumb" value={f.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} className="input" placeholder="https://…" />
          </div>
        </div>

        {/* Files (PDF / ZIP) — saved instantly, no need to press Save */}
        <div>
          <Label>Files — PDF or ZIP (private: only students who paid can download)</Label>
          {info && <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ {info}</p>}
          {productId ? (
            <FilesManager productId={productId} />
          ) : (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
              Fill in the details above and click <strong>Save</strong> — then you can add files here.
            </p>
          )}
        </div>

        {/* Content links (mostly for crash courses) */}
        <div>
          <Label>Content links {f.category === "crash_course" ? "(class / video / notes links for buyers)" : "(optional)"}</Label>
          <div className="space-y-2">
            {links === null && <p className="text-sm text-slate-500">Loading links…</p>}
            {(links ?? []).map((l, i) => (
              <div key={i} className="flex gap-2">
                <input value={l.title} onChange={(e) => setLinks((ls) => ls!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Name, e.g. Day 1 class" className="input !w-2/5" aria-label={`Link ${i + 1} name`} />
                <input value={l.url} onChange={(e) => setLinks((ls) => ls!.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className="input" aria-label={`Link ${i + 1} address`} />
                <button type="button" onClick={() => setLinks((ls) => ls!.filter((_, j) => j !== i))} className="btn-light !px-3 !text-red-600" aria-label={`Remove link ${i + 1}`}><TrashIcon /></button>
              </div>
            ))}
            <button type="button" onClick={() => setLinks((ls) => [...(ls ?? []), { title: "", url: "" }])} className="btn-light !px-3 !py-2 text-sm"><PlusIcon /> Add link</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">These links are private: only students who paid can see them.</p>
        </div>

        <details className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">Advanced: web name, order & extra display info</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pf-slug">Web name (slug)</Label>
              <input id="pf-slug" value={f.slug} onChange={(e) => set("slug", e.target.value)} className="input" placeholder="made from the title if empty" />
            </div>
            <div>
              <Label htmlFor="pf-sort">Order (lower = first)</Label>
              <input id="pf-sort" type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="input" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pf-details">Extra display info (JSON: badge, features, duration, syllabus…)</Label>
              <textarea id="pf-details" rows={6} value={f.details} onChange={(e) => set("details", e.target.value)} className="input font-mono !text-xs" spellCheck={false} />
            </div>
          </div>
        </details>

        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** "Storage used: 120 MB of 1 GB" — so you know before Supabase's limit is reached */
function StorageBar({ storage }: { storage: StorageInfo }) {
  const used = storage.usedBytes ?? storage.filesBytes;
  const limit = siteConfig.uploads.storageLimitGB * 1024 * 1024 * 1024;
  const pct = Math.min(100, Math.round((used / limit) * 1000) / 10);
  const tone = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="card mb-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-semibold text-slate-700">File storage used</p>
        <p className="text-slate-600"><strong className="text-slate-900">{formatBytes(used)}</strong> of {siteConfig.uploads.storageLimitGB} GB ({pct}%)</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, 1)}%` }} /></div>
      <p className="mt-1.5 text-xs text-slate-500">
        Max {siteConfig.uploads.maxFileMB} MB per file. {pct >= 80 ? "You are close to the limit — delete old files or upgrade your Supabase plan." : "Supabase Free plan: 1 GB storage, 50 MB per file."}
      </p>
    </div>
  );
}
