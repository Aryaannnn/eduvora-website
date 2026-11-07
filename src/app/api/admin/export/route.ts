// GET /api/admin/export → eduvora-export-YYYY-MM-DD.zip (one CSV per table)
// ADMINS ONLY (checked on the server). Used by Admin → Settings → "Export all data".
// Opens in Excel / Google Sheets. Not a replacement for the encrypted daily
// database backup (BACKUPS.md) — this is an easy-to-read copy.
import { strToU8, zipSync } from "fflate";
import { NextResponse } from "next/server";
import { hasAdmin2fa } from "@/lib/admin";
import { getSession } from "@/lib/dashboard";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;

// file name → table. The first 8 are the main ones; the rest are added if they exist.
const TABLES: [string, string][] = [
  ["students", "profiles"],
  ["products", "products"],
  ["purchases", "purchases"],
  ["bookings", "bookings"],
  ["tests", "tests"],
  ["reviews", "reviews"],
  ["enquiries", "enquiries"],
  ["predictions", "predictions"],
  ["slots", "slots"],
  ["test-questions", "questions"],
  ["test-attempts", "test_attempts"],
  ["product-files", "product_files"],
  ["coupons", "coupons"],
  ["coupon-uses", "coupon_redemptions"],
  ["referrals", "referrals"],
  ["reward-credits", "reward_ledger"],
  ["session-credit-adjustments", "session_credit_adjustments"],
  ["important-dates", "important_dates"],
  ["site-updates", "site_updates"],
  ["blog-posts", "blog_posts"],
  ["video-testimonials", "video_testimonials"],
  ["session-feedback", "session_feedback"],
  ["leads", "leads"],
  ["lead-notes", "lead_notes"],
  ["email-logs", "email_logs"],
];
const PAGE = 1000;

/** One CSV cell. Formulas are neutralised so Excel never runs them (CSV injection). */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // =, @ and +/- followed by anything other than a plain number/phone could be an Excel formula
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (session.profile?.role !== "admin") return NextResponse.json({ error: "Only admins can export data." }, { status: 403 });
  if (!(await hasAdmin2fa(session))) return NextResponse.json({ error: "Please confirm it's you with your authenticator app first (reload the page)." }, { status: 403 });
  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ error: "Export is not available (server key missing)." }, { status: 503 });

  const files: Record<string, Uint8Array> = {};
  const summary: string[] = [];
  for (const [file, table] of TABLES) {
    const rows: Record<string, unknown>[] = [];
    let missing = false;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select("*").order("created_at", { ascending: true, nullsFirst: true }).range(from, from + PAGE - 1);
      // some small tables have no created_at — try again without ordering
      const res = error && /created_at/.test(error.message) ? await db.from(table).select("*").range(from, from + PAGE - 1) : { data, error };
      if (res.error) {
        missing = true;
        break;
      }
      rows.push(...((res.data ?? []) as Record<string, unknown>[]));
      if (!res.data || res.data.length < PAGE) break;
    }
    if (missing) continue; // table not set up yet
    files[`${file}.csv`] = strToU8(toCsv(rows) || "(no rows)\r\n");
    summary.push(`${file}.csv`.padEnd(34) + `${rows.length} rows`);
  }

  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  files["README.txt"] = strToU8(
    [
      "EDUVORA — data export",
      `Made: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(now)} IST by ${session.user.email ?? "admin"}`,
      "",
      "Open any .csv file in Excel or Google Sheets. Times are in UTC (add 5:30 for India time).",
      "Contains personal data (names, phones, emails) — keep this file private and delete it when done.",
      "",
      ...summary,
    ].join("\r\n"),
  );

  // Activity Log (supabase/admin-security.sql) — recorded with the admin's own login
  const { error: logErr } = await session.supabase.rpc("log_admin_event", {
    p_action: "data.export",
    p_summary: `Downloaded "Export all data" (${summary.length} files)`,
    p_details: { files: summary },
  });
  if (logErr && !/log_admin_event|function/i.test(logErr.message)) console.warn("[export] activity log:", logErr.message);

  const zip = zipSync(files, { level: 6 });
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="eduvora-export-${day}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
