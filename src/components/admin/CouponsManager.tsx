"use client";

// Admin → Coupons: create / edit / activate / deactivate codes, and see every use.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCoupon, saveCoupon, setCouponActive, type CouponInput } from "@/app/admin/actions";
import { csvDateTimeIST, formatDateTime, formatPrice } from "@/lib/format";
import { EditIcon, PlusIcon, TagIcon, TrashIcon } from "../Icons";
import { AdminHeader, Label, Modal, Notice, Toggle, downloadCsv } from "./ui";

export type AdminCoupon = {
  id: string; code: string; description: string | null; discount_type: "percent" | "flat"; discount_value: number; max_discount: number | null;
  min_amount: number; applies_to: "all" | "selected"; product_ids: string[]; include_slots: boolean; starts_at: string | null; ends_at: string | null;
  max_uses: number | null; once_per_student: boolean; is_active: boolean; created_at: string; used?: number;
};
export type CouponUse = { id: string; code: string; student: string; email: string; item: string; paid: number | null; discount: number; status: "used" | "cancelled"; at: string };
type Product = { id: string; title: string; category: string; price: number };

const CAT: Record<string, string> = { crash_course: "Courses", study_material: "Study material", previous_paper: "Papers", mock_test: "Tests", counselling_package: "Packages" };
const istDay = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "");
const offText = (c: AdminCoupon) => (c.discount_type === "percent" ? `${c.discount_value}% off${c.max_discount ? ` (max ₹${c.max_discount})` : ""}` : `₹${c.discount_value} off`);

function stateOf(c: AdminCoupon) {
  const now = Date.now();
  if (!c.is_active) return { label: "Inactive", style: "bg-slate-100 text-slate-500" };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: "Scheduled", style: "bg-sky-50 text-sky-700" };
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { label: "Expired", style: "bg-rose-50 text-rose-700" };
  if (c.max_uses && (c.used ?? 0) >= c.max_uses) return { label: "Used up", style: "bg-amber-50 text-amber-800" };
  return { label: "Active", style: "bg-emerald-50 text-emerald-700" };
}

export default function CouponsManager({ coupons, uses, products, setupMissing }: { coupons: AdminCoupon[]; uses: CouponUse[]; products: Product[]; setupMissing: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);
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
  const totalDiscount = uses.filter((u) => u.status === "used").reduce((t, u) => t + u.discount, 0);
  const title = (id: string) => products.find((p) => p.id === id)?.title ?? "Removed item";

  return (
    <>
      <AdminHeader title="Coupons" subtitle={`${coupons.length} code${coupons.length === 1 ? "" : "s"} · ${uses.filter((u) => u.status === "used").length} uses · ₹${totalDiscount.toLocaleString("en-IN")} given as discount`}>
        <button type="button" onClick={() => setEditing("new")} disabled={setupMissing} className="btn-primary disabled:opacity-50"><PlusIcon className="h-4 w-4" /> New coupon</button>
      </AdminHeader>
      {setupMissing && <div className="mb-4"><Notice kind="error">Run supabase/coupons-referrals.sql in Supabase → SQL Editor first.</Notice></div>}
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      <div className={`card overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Valid for</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Uses</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No coupons yet.</td></tr>}
            {coupons.map((c) => {
              const st = stateOf(c);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="inline-flex items-center gap-1.5 font-mono text-sm font-extrabold text-slate-900"><TagIcon className="h-4 w-4 text-accent-600" />{c.code}</p>
                    {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{offText(c)}</p>
                    {c.min_amount > 0 && <p className="text-xs text-slate-500">Min. ₹{c.min_amount.toLocaleString("en-IN")}</p>}
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-xs text-slate-600">
                    {c.applies_to === "all" ? "Everything" : [...c.product_ids.map(title), ...(c.include_slots ? ["Single slots"] : [])].join(", ")}
                    {c.applies_to === "all" && !c.include_slots && " except single slots"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{c.starts_at || c.ends_at ? `${istDay(c.starts_at) || "now"} → ${istDay(c.ends_at) || "no end"}` : "Always"}</td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold text-slate-800">{c.used ?? 0}{c.max_uses ? ` / ${c.max_uses}` : ""}</p>
                    <p className="text-slate-500">{c.once_per_student ? "Once per student" : "Many per student"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.style}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Toggle checked={c.is_active} onChange={(v) => run(() => setCouponActive(c.id, v))} label="" />
                      <button type="button" onClick={() => setEditing(c)} className="btn-light !px-2.5 !py-1.5" aria-label={`Edit ${c.code}`}><EditIcon /></button>
                      <button type="button" onClick={() => confirm(`Delete coupon ${c.code}?`) && run(() => deleteCoupon(c.id))} className="btn-light !px-2.5 !py-1.5 !text-red-600" aria-label={`Delete ${c.code}`}><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Every use */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Coupon uses</h2>
          <p className="text-sm text-slate-500">Counted only after a successful payment. Refunded payments show as cancelled.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv("coupon-uses.csv", ["Date", "Code", "Student", "Email", "Item", "Paid (INR)", "Discount (INR)", "Status"], uses.map((u) => [csvDateTimeIST(u.at), u.code, u.student, u.email, u.item, u.paid, u.discount, u.status]))}
          className="btn-light"
        >
          Export CSV
        </button>
      </div>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {uses.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No coupon uses yet.</td></tr>}
            {uses.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDateTime(u.at)}</td>
                <td className="px-4 py-3 font-mono font-bold">{u.code}</td>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{u.student}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                <td className="px-4 py-3 text-slate-700">{u.item}</td>
                <td className="px-4 py-3 font-semibold text-emerald-700">− ₹{u.discount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">{u.paid !== null ? formatPrice(u.paid) : "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${u.status === "used" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{u.status === "used" ? "Used" : "Cancelled"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CouponForm coupon={editing === "new" ? null : editing} products={products} pending={pending} onClose={() => setEditing(null)} onSave={(v) => run(() => saveCoupon(v), () => setEditing(null))} />
      )}
    </>
  );
}

function CouponForm({ coupon, products, pending, onClose, onSave }: { coupon: AdminCoupon | null; products: Product[]; pending: boolean; onClose: () => void; onSave: (v: CouponInput) => void }) {
  const [f, setF] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discount_type: coupon?.discount_type ?? ("percent" as "percent" | "flat"),
    discount_value: String(coupon?.discount_value ?? ""),
    max_discount: coupon?.max_discount ? String(coupon.max_discount) : "",
    min_amount: coupon?.min_amount ? String(coupon.min_amount) : "",
    applies_to: coupon?.applies_to ?? ("all" as "all" | "selected"),
    product_ids: coupon?.product_ids ?? [],
    include_slots: coupon?.include_slots ?? true,
    starts_at: istDay(coupon?.starts_at ?? null),
    ends_at: istDay(coupon?.ends_at ?? null),
    max_uses: coupon?.max_uses ? String(coupon.max_uses) : "",
    once_per_student: coupon?.once_per_student ?? true,
    is_active: coupon?.is_active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleProduct = (id: string) => set("product_ids", f.product_ids.includes(id) ? f.product_ids.filter((x) => x !== id) : [...f.product_ids, id]);
  const groups = [...new Set(products.map((p) => p.category))];

  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : "New coupon"} onClose={onClose} wide>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSave({ id: coupon?.id, ...f }); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="c-code">Code *</Label><input id="c-code" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} className="input font-mono uppercase" placeholder="e.g. VITEEE20" maxLength={30} required /></div>
          <div><Label htmlFor="c-desc">Note (only you see it)</Label><input id="c-desc" value={f.description} onChange={(e) => set("description", e.target.value)} className="input" placeholder="e.g. Instagram offer" /></div>
          <div>
            <Label htmlFor="c-type">Discount type</Label>
            <select id="c-type" value={f.discount_type} onChange={(e) => set("discount_type", e.target.value as "percent" | "flat")} className="input">
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat amount (₹)</option>
            </select>
          </div>
          <div><Label htmlFor="c-val">{f.discount_type === "percent" ? "Percent off *" : "Rupees off *"}</Label><input id="c-val" type="number" min={1} max={f.discount_type === "percent" ? 100 : undefined} inputMode="numeric" value={f.discount_value} onChange={(e) => set("discount_value", e.target.value)} className="input" required /></div>
          {f.discount_type === "percent" && (
            <div><Label htmlFor="c-max">Maximum discount (₹)</Label><input id="c-max" type="number" min={1} inputMode="numeric" value={f.max_discount} onChange={(e) => set("max_discount", e.target.value)} className="input" placeholder="optional" /></div>
          )}
          <div><Label htmlFor="c-min">Minimum order amount (₹)</Label><input id="c-min" type="number" min={0} inputMode="numeric" value={f.min_amount} onChange={(e) => set("min_amount", e.target.value)} className="input" placeholder="0" /></div>
          <div><Label htmlFor="c-start">Start date</Label><input id="c-start" type="date" value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} className="input" /></div>
          <div><Label htmlFor="c-end">End date (last day it works)</Label><input id="c-end" type="date" value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} className="input" /></div>
          <div><Label htmlFor="c-uses">Maximum total uses</Label><input id="c-uses" type="number" min={1} inputMode="numeric" value={f.max_uses} onChange={(e) => set("max_uses", e.target.value)} className="input" placeholder="no limit" /></div>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Valid for</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={f.applies_to === "all"} onChange={() => set("applies_to", "all")} className="accent-brand-600" /> All products &amp; packages</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={f.applies_to === "selected"} onChange={() => set("applies_to", "selected")} className="accent-brand-600" /> Only the ones I choose</label>
          </div>
          {f.applies_to === "selected" && (
            <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              {groups.map((g) => (
                <div key={g}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{CAT[g] ?? g}</p>
                  {products.filter((p) => p.category === g).map((p) => (
                    <label key={p.id} className="mt-1 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={f.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} className="h-4 w-4 accent-brand-600" />
                      {p.title} <span className="text-xs text-slate-400">₹{p.price}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3"><Toggle checked={f.include_slots} onChange={(v) => set("include_slots", v)} label="Also works on single counselling slots" /></div>
        </fieldset>

        <div className="flex flex-wrap gap-6">
          <Toggle checked={f.once_per_student} onChange={(v) => set("once_per_student", v)} label="One use per student" />
          <Toggle checked={f.is_active} onChange={(v) => set("is_active", v)} label="Active" />
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">The final price is always worked out on the server and never goes below ₹1. A coupon counts as used only after the payment succeeds.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-light">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save coupon"}</button>
        </div>
      </form>
    </Modal>
  );
}
