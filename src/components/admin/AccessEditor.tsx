"use client";

// Admin → Products → "Access duration": Lifetime / N days from enrolment / until a date,
// + "Allow renewals". Stored in the product's details (details.access) — saved with the product.
import { accessLabel, productAccess, type ProductAccess } from "@/lib/access";
import { Label } from "./ui";

export default function AccessEditor({ json, onChange }: { json: string; onChange: (json: string) => void }) {
  let d: Record<string, unknown>;
  try {
    const parsed = JSON.parse(json || "{}");
    d = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return <p className="text-xs font-semibold text-amber-800">Fix the &ldquo;Extra display info&rdquo; JSON (Advanced) to edit the access duration.</p>;
  }
  const a = productAccess(d);
  const put = (next: ProductAccess) => {
    const access: Record<string, unknown> = { kind: next.kind, renewals: !!next.renewals };
    if (next.kind === "days") access.days = next.days;
    if (next.kind === "until") access.until = next.until;
    onChange(JSON.stringify({ ...d, access }, null, 2));
  };

  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:col-span-2">
      <Label>Access duration</Label>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" name="acc" checked={a.kind === "lifetime"} onChange={() => put({ ...a, kind: "lifetime" })} /> Lifetime</label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="acc" checked={a.kind === "days"} onChange={() => put({ ...a, kind: "days", days: a.days ?? 365 })} /> Days from enrolment:
          <input type="number" min={1} max={3650} value={a.kind === "days" ? a.days : 365} disabled={a.kind !== "days"} onChange={(e) => put({ ...a, kind: "days", days: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className="input !w-24 !py-1.5 disabled:bg-slate-100" aria-label="Number of days" />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="acc" checked={a.kind === "until"} onChange={() => put({ ...a, kind: "until", until: a.until ?? "" })} /> Until a fixed date:
          <input type="date" value={a.kind === "until" ? a.until ?? "" : ""} disabled={a.kind !== "until"} onChange={(e) => put({ ...a, kind: "until", until: e.target.value })} className="input !w-auto !py-1.5 disabled:bg-slate-100" aria-label="Access end date" />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={!!a.renewals} onChange={(e) => put({ ...a, renewals: e.target.checked })} /> Allow renewals (students whose access ended see a &ldquo;Renew&rdquo; button and can buy again)
      </label>
      <p className="mt-2 text-xs text-slate-500">
        Students see: <strong>{accessLabel(a)}</strong>. When you Save, students who already bought this get the new rule counted from today
        (&ldquo;until a date&rdquo;: everyone gets that date; Lifetime: everyone gets lifetime). Access you extended by hand in Admin → Students is never changed.
      </p>
    </div>
  );
}
