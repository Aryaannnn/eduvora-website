// GET /api/files/<file id>            → download the file
// GET /api/files/<file id>?view=1     → open a PDF in the browser
// The server checks: logged in AND (paid for the product, or it's free, or admin).
//
// Students:
//   • PDF → a WATERMARKED copy is made on the server ("Licensed to <name> •
//     <email> • EDUVORA" on every page + footer with date and Download ID),
//     saved for a moment in the private 'watermarked' bucket and opened with a
//     60-second link. The original in 'materials' is never changed.
//     If watermarking fails → "Please try again" (the original is NEVER sent).
//   • ZIP → can't be watermarked; sent as is (60-second link).
//   • Every download is logged (Admin → Products → Downloads).
// Admins get the original file (not logged).
import { after, NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dashboard";
import { unlockFreeProduct } from "@/lib/free-resources";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { cleanupWatermarked, deviceId, watermarkPdf } from "@/lib/watermark";

export const maxDuration = 60;

const text = (msg: string, status: number) => new NextResponse(msg, { status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

/** Friendly page when the watermarked copy couldn't be made. */
function tryAgain(id: string, view: boolean) {
  const retry = `/api/files/${id}${view ? "?view=1" : ""}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Please try again</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f5f9;font-family:system-ui,sans-serif;color:#0b2a5b}main{max-width:26rem;margin:1rem;background:#fff;border-radius:1.5rem;padding:2rem;text-align:center;box-shadow:0 10px 30px #0b2a5b1a}h1{font-size:1.4rem;margin:.5rem 0}p{color:#475569;line-height:1.6}a{display:inline-block;margin:.4rem;padding:.75rem 1.2rem;border-radius:.8rem;font-weight:700;text-decoration:none}.p{background:#0b2a5b;color:#fff}.l{background:#e2e8f0;color:#0b2a5b}</style></head>
<body><main><div style="font-size:2.2rem">⏳</div><h1>Please try again</h1><p>We couldn't prepare your personal copy of this file just now. Please try again in a moment. If it keeps happening, contact us and we'll send it to you.</p>
<a class="p" href="${retry}">Try again</a><a class="l" href="/dashboard/courses">Back to My Courses</a></main></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Retry-After": "10" } });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const view = request.nextUrl.searchParams.get("view") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return text("File not found.", 404);

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/dashboard/courses")}`, request.url));
  const db = getAdminSupabase();
  if (!db) return text("Downloads are not available right now.", 503);

  const { data: f } = await db
    .from("product_files")
    .select("id,display_name,file_path,file_type,product_id,products(is_free,is_active)")
    .eq("id", id)
    .maybeSingle();
  if (!f) return text("File not found.", 404);
  const product = f.products as unknown as { is_free: boolean; is_active: boolean } | null;

  const isAdmin = session.profile?.role === "admin";
  const freeItem = !!product?.is_active && !!product?.is_free;
  let allowed = isAdmin || freeItem;
  // Free item opened from a direct link → also add it to My Courses (and Admin → Students)
  if (freeItem && !isAdmin) await unlockFreeProduct(db, session.user.id, f.product_id as string);
  if (!allowed) {
    const { count } = await db
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("product_id", f.product_id)
      .eq("status", "paid");
    allowed = (count ?? 0) > 0;
  }
  if (!allowed) return text("You need to buy this item before downloading it. If you already paid, please contact us.", 403);

  const fileName = `${f.display_name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "file"}.${f.file_type}`;
  const inline = view && f.file_type === "pdf";

  // ---------- admins: the original ----------
  if (isAdmin) {
    const { data: signed, error } = await db.storage.from("materials").createSignedUrl(f.file_path, 60, inline ? undefined : { download: fileName });
    if (error || !signed) return text("This file is being prepared. Please try again in a little while.", 404);
    return NextResponse.redirect(signed.signedUrl);
  }

  // ---------- students ----------
  const downloadId = crypto.randomUUID();
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const log = (fields: { watermarked: boolean; status: "ok" | "failed"; error?: string }) =>
    db
      .from("file_downloads")
      .insert({
        id: downloadId,
        user_id: session.user.id,
        file_id: f.id,
        product_id: f.product_id,
        file_name: fileName,
        file_type: f.file_type,
        action: inline ? "view" : "download",
        device: deviceId(ip, ua),
        user_agent: ua || null,
        ...fields,
      })
      .then(({ error }) => error && console.warn("[downloads] log failed (run supabase/watermark-downloads.sql?):", error.message));

  let target: string;
  if (f.file_type === "pdf") {
    try {
      const { data: blob, error: dlErr } = await db.storage.from("materials").download(f.file_path);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "original not found");
      const marked = await watermarkPdf(new Uint8Array(await blob.arrayBuffer()), {
        name: session.profile?.full_name || session.user.email?.split("@")[0] || "Student",
        email: session.profile?.email || session.user.email || "",
        downloadId,
        when: new Date(),
      });
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const tmpPath = `${day}/${downloadId}.pdf`;
      const { error: upErr } = await db.storage.from("watermarked").upload(tmpPath, marked, { contentType: "application/pdf", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: signed, error: sErr } = await db.storage.from("watermarked").createSignedUrl(tmpPath, 60, inline ? undefined : { download: fileName });
      if (sErr || !signed) throw new Error(sErr?.message ?? "no link");
      target = signed.signedUrl;
      await log({ watermarked: true, status: "ok" });
    } catch (e) {
      // Never fall back to the un-watermarked original
      console.warn("[downloads] watermark failed:", (e as Error).message);
      await log({ watermarked: false, status: "failed", error: (e as Error).message.slice(0, 300) });
      return tryAgain(id, view);
    }
  } else {
    // ZIP files can't be watermarked
    const { data: signed, error } = await db.storage.from("materials").createSignedUrl(f.file_path, 60, { download: fileName });
    if (error || !signed) return text("This file is being prepared. Please try again in a little while or contact us.", 404);
    target = signed.signedUrl;
    await log({ watermarked: false, status: "ok" });
  }

  await db.rpc("count_file_download", { p_file: f.id }); // download counter (admin sees it)
  after(() => cleanupWatermarked(db).catch(() => 0)); // remove yesterday's temporary copies
  const res = NextResponse.redirect(target);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
