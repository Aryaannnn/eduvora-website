import { siteConfig } from "@/config/site";
import { stateFromGstin } from "@/lib/invoice-math";
import { loadSignature, SIGNATURE_BUCKET, SIGNATURE_FILE } from "@/lib/invoices";
import { ReceiptIcon } from "../Icons";

function Row({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${ok === null ? "bg-slate-100 text-slate-500" : ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
        {ok === null ? "–" : ok ? "✓" : "!"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Admin → Settings → Invoices: status of the signature / GST / address + "Preview sample invoice". */
export default async function InvoiceSettingsCard() {
  const c = siteConfig.invoice;
  const signature = c.showSignature ? await loadSignature() : null;
  const gstin = c.gstin.trim();
  const gstState = gstin ? stateFromGstin(gstin) : null;
  return (
    <section id="invoices" className="card mb-8 scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><ReceiptIcon className="h-6 w-6" /></span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Invoices (PDF)</h2>
            <p className="text-sm text-slate-500">The same design is used for the email attachment, the student&apos;s download and your download. Invoices never change after they are made.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/invoice-sample" target="_blank" rel="noopener" className="btn-primary !px-4 !py-2.5 text-sm">Preview sample invoice</a>
          <a href="/api/admin/invoice-sample?gst=1" target="_blank" rel="noopener" className="btn-light !px-4 !py-2.5 text-sm">Preview with GST</a>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        <Row ok={!c.showSignature ? null : !!signature}>
          <strong>Signature:</strong>{" "}
          {!c.showSignature
            ? "switched off (src/config/site.ts → invoice.showSignature)."
            : signature
              ? "found — printed above “Authorised Signatory”."
              : <>not found — upload <code className="rounded bg-slate-100 px-1">{SIGNATURE_FILE}</code> to the PRIVATE bucket <code className="rounded bg-slate-100 px-1">{SIGNATURE_BUCKET}</code> in Supabase → Storage. Until then invoices are made without it.</>}
        </Row>
        <Row ok={gstin ? !!gstState : null}>
          <strong>GST:</strong>{" "}
          {!gstin ? "no GSTIN set → invoices say “INVOICE / RECEIPT” without GST lines." : gstState ? `GSTIN ${gstin} (${gstState.name}) → “TAX INVOICE” with CGST + SGST @ ${c.gstRatePercent / 2}% each (included in the price).` : `GSTIN “${gstin}” doesn't look valid — GST lines are not printed until it's fixed.`}
        </Row>
        <Row ok={c.address.trim() ? true : null}>
          <strong>Business address:</strong> {c.address.trim() ? c.address.trim() : "not set (src/config/site.ts → invoice.address). Shown on invoices only."}
        </Row>
        <Row ok={c.udyam.trim() ? true : null}>
          <strong>Udyam number:</strong> {c.udyam.trim() || "not set (optional)."}
        </Row>
      </ul>
    </section>
  );
}
