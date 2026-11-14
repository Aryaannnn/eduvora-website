// GET /api/invoices/<purchase or booking id> — the PDF invoice.
//   ?view=1 → shown in the browser instead of downloaded (the /invoice page uses it)
// Who may open it (checked here on the SERVER, every time):
//   • the student who paid — only their OWN invoices
//   • admins — any invoice, but only with 2-step login (like the admin panel)
//   • anyone else → "Not found" (we don't even say whether it exists)
// The same PDF builder makes the email attachment, so all three look the same.
import type { NextRequest } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { buildInvoicePdf, getInvoiceData, invoiceFileName } from "@/lib/invoices";
import { getAdminSupabase } from "@/lib/supabase/admin";

const notFound = () => new Response("Invoice not found.", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(req: NextRequest, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Please log in to download invoices.", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const db = getAdminSupabase();
  if (!db) return new Response("Not configured", { status: 503 });

  const inv = await getInvoiceData(db, id);
  if (!inv) return notFound();
  const own = !!inv.userId && inv.userId === session.user.id;
  const admin = session.profile?.role === "admin" && (await hasAdmin2fa(session));
  if (!own && !admin) return notFound();

  const pdf = await buildInvoicePdf(inv);
  const view = req.nextUrl.searchParams.get("view") === "1";
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${view ? "inline" : "attachment"}; filename="${invoiceFileName(inv)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
