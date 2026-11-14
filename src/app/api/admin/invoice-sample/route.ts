// GET /api/admin/invoice-sample — Admin → Settings → "Preview sample invoice".
// A dummy invoice (no real student, watermarked SAMPLE) in the exact same design,
// with your real logo, seller details and signature. ?gst=1 previews the
// "TAX INVOICE" version with GST lines (uses a dummy GSTIN if none is set).
// Admins with 2-step login only.
import type { NextRequest } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { buildInvoicePdf, sampleInvoice } from "@/lib/invoices";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.profile?.role !== "admin" || !(await hasAdmin2fa(s))) {
    return new Response("Not found.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const pdf = await buildInvoicePdf(sampleInvoice(req.nextUrl.searchParams.get("gst") === "1"), { sample: true });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="sample-invoice.pdf"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
