import type { Metadata } from "next";
import { Suspense } from "react";
import BackButton from "@/components/BackButton";
import { DashSkeleton } from "@/components/dashboard/ui";
import { hasAdmin2fa } from "@/lib/admin";
import { requireUser } from "@/lib/dashboard";
import { getInvoiceData } from "@/lib/invoices";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

// Shows the REAL PDF invoice (the same one that is emailed and downloaded).
// Students see only their own invoices; admins (with 2-step login) see any.
export default function InvoicePage(props: PageProps<"/invoice/[id]">) {
  return (
    <section className="min-h-[60vh] bg-slate-50 py-8 sm:py-12">
      <div className="container-page">
        <Suspense fallback={<div className="mx-auto max-w-3xl"><DashSkeleton /></div>}>
          {props.params.then(({ id }) => <Invoice id={id} />)}
        </Suspense>
      </div>
    </section>
  );
}

const notAvailable = (
  <p className="card mx-auto max-w-2xl p-8 text-center text-slate-600">
    Invoice not available. Invoices are created once a payment is confirmed.
  </p>
);

async function Invoice({ id }: { id: string }) {
  const s = await requireUser(`/invoice/${id}`);
  const db = getAdminSupabase();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) return notAvailable;
  const inv = await getInvoiceData(db, id);
  if (!inv) return notAvailable;
  const own = !!inv.userId && inv.userId === s.user.id;
  const admin = s.profile?.role === "admin" && (await hasAdmin2fa(s));
  if (!own && !admin) return notAvailable; // never reveal someone else's invoice

  const src = `/api/invoices/${id}`;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <BackButton />
        <span className="flex flex-wrap gap-2">
          <a href={src} download className="btn-accent !px-4 !py-2.5 text-sm">Download PDF</a>
          <a href={`${src}?view=1`} target="_blank" rel="noopener" className="btn-light !px-4 !py-2.5 text-sm">Open / Print</a>
        </span>
      </div>
      <p className="mb-3 text-sm text-slate-600">
        Invoice <strong className="text-slate-900">{inv.invoiceNumber}</strong> · {inv.itemTitle}
      </p>
      <div className="card overflow-hidden p-0">
        {/* A4 shape; phones that can't show PDFs inside a page get the buttons above */}
        <iframe src={`${src}?view=1#view=FitH`} title={`Invoice ${inv.invoiceNumber}`} className="aspect-[1/1.414] w-full bg-white" />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Can&apos;t see the invoice? Use &ldquo;Download PDF&rdquo; above.</p>
    </div>
  );
}
