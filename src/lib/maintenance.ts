// =====================================================================
//  MAINTENANCE MODE — used by src/proxy.ts before every request
//  (switch + message: Admin → Settings → Maintenance mode,
//   table: supabase/maintenance.sql)
//
//  While ON:
//   • admins & counsellors (logged in) use the whole site normally
//   • everyone else gets the branded maintenance page, HTTP 503 +
//     Retry-After, so search engines know it's temporary
//   • these always keep working: Razorpay webhook + payment checks,
//     cron jobs, admin login / 2-step page, sign-in links, WhatsApp link
// =====================================================================
import { siteConfig } from "@/config/site";
import { DEFAULT_MAINTENANCE_MESSAGE } from "./maintenance-shared";

export { DEFAULT_MAINTENANCE_MESSAGE };

/** Paths that keep working during maintenance (for everyone). */
const ALWAYS_OPEN = [
  "/api/payments/", // Razorpay webhook + verify/check (a payment in progress must still be saved)
  "/api/bookings/", // finishing a booking payment that was already started
  "/api/cron/", // reminders, payment checks, leads, Meet links
  "/api/admin/", // admin export, Google Calendar connect, activity ping
  "/admin", // admin pages check the role themselves (logged out → login; students → dashboard → maintenance page)
  "/admin-verify", // admin 2-step check
  "/login", // so admins can log in
  "/auth/", // sign-in links, Google sign-in, logout
  "/go/whatsapp", // the maintenance page's WhatsApp button
  "/reset-password",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

export type MaintenanceAction = "allow" | "page" | "api";

/** What to do with this request while maintenance is ON. */
export function maintenanceAction(path: string, isStaff: boolean): MaintenanceAction {
  if (isStaff) return "allow";
  // "/login" opens /login and /login/… but NOT /loginxyz; "/api/cron/" opens everything under it
  const open = (p: string) => (p.endsWith("/") ? path === p.slice(0, -1) || path.startsWith(p) : path === p || path.startsWith(`${p}/`));
  if (ALWAYS_OPEN.some(open)) return "allow";
  if (path.startsWith("/_next/") || path.startsWith("/.well-known/")) return "allow";
  return path.startsWith("/api/") ? "api" : "page";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The branded maintenance page (plain HTML, so it works even if the app can't render). */
export function maintenanceHtml(message: string): string {
  const name = esc(siteConfig.businessName);
  const email = esc(siteConfig.email);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${name} — Back soon</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;
    background:radial-gradient(1200px 600px at 10% -10%,#1e3a8a 0%,transparent 60%),radial-gradient(900px 500px at 110% 110%,#b45309 0%,transparent 55%),#0b1b3f}
  main{width:100%;max-width:520px;background:#fff;border-radius:28px;padding:40px 28px;text-align:center;box-shadow:0 30px 80px rgba(2,6,23,.45)}
  img{display:block;height:64px;width:auto;margin:0 auto}
  .badge{display:inline-block;margin-top:22px;padding:6px 14px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:800;font-size:13px;letter-spacing:.3px}
  h1{margin:14px 0 8px;font-size:28px;line-height:1.2}
  p{margin:0;color:#475569;line-height:1.65;font-size:16px;white-space:pre-line}
  .btns{margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  a.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:999px;font-weight:700;text-decoration:none;font-size:15px}
  .wa{background:#25D366;color:#fff}.mail{background:#0b2a5b;color:#fff}
  .small{margin-top:22px;font-size:13px;color:#94a3b8}
  svg{width:18px;height:18px;fill:currentColor}
</style>
</head>
<body>
<main>
  <img src="/logo.png" alt="${name} logo" width="220" height="64">
  <div class="badge">🛠️ Under maintenance</div>
  <h1>We'll be back soon</h1>
  <p>${esc(message || DEFAULT_MAINTENANCE_MESSAGE)}</p>
  <div class="btns">
    <a class="btn wa" href="/go/whatsapp" rel="nofollow">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z"/></svg>
      Chat on WhatsApp
    </a>
    <a class="btn mail" href="mailto:${email}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4.5 7.5v.3l7.5 4.9 7.5-4.9v-.3L12 12.2Z"/></svg>
      Email us
    </a>
  </div>
  <p class="small">${email} · Payments and bookings already made are safe.</p>
</main>
</body>
</html>`;
}
