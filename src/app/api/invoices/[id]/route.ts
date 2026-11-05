// GET /api/invoices/<purchase or booking id> — download the PDF invoice.
// Students: only their own. Admins: any.
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { buildInvoicePdf, getInvoiceData, invoiceFileName } from "@/lib/invoices";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Please log in to download invoices.", { status: 401 });
  const db = getAdminSupabase();
  if (!db) return new Response("Not configured", { status: 503 });

  const inv = await getInvoiceData(db, id);
  if (!inv) return new Response("Invoice not available. Invoices are created once a payment is confirmed.", { status: 404 });
  if (inv.userId !== session.user.id && session.profile?.role !== "admin") return new Response("Not found", { status: 404 });

  const pdf = await buildInvoicePdf(inv);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFileName(inv)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
