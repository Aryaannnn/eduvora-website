// =====================================================================
//  EMAIL LOOK — EDUVORA navy + gold, works in Gmail/Outlook and on phones
//  (simple tables + inline styles, max 600px wide)
// =====================================================================
import { siteConfig } from "@/config/site";

const NAVY = "#0b2a5b";
const GOLD = "#f2a900";

/** Make student-typed text safe to put inside an email */
export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const site = siteConfig.siteUrl.replace(/\/$/, "");
// Email apps can only show the logo from a public https address (not localhost)
const logoUrl = site.startsWith("https://") ? `${site}/logo-email.png` : null;

export const url = (path: string) => `${site}${path}`;

export function button(label: string, href: string, kind: "gold" | "navy" | "green" = "gold") {
  const bg = kind === "gold" ? GOLD : kind === "green" ? "#25D366" : NAVY;
  const color = kind === "gold" ? NAVY : "#ffffff";
  return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${color};font-weight:bold;font-size:15px;text-decoration:none;padding:13px 22px;border-radius:10px;margin:4px 6px 4px 0">${esc(label)}</a>`;
}

/** Two-column details box: [["Date","Mon, 10 Nov"], …] */
export function details(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;margin:16px 0">
${rows
  .map(
    ([k, v], i) =>
      `<tr><td style="padding:11px 14px;font-size:14px;color:#64748b;${i ? "border-top:1px solid #f1f5f9;" : ""}">${esc(k)}</td><td align="right" style="padding:11px 14px;font-size:14px;font-weight:bold;color:#0f172a;${i ? "border-top:1px solid #f1f5f9;" : ""}">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>`;
}

export function note(html: string, tone: "gold" | "green" | "navy" = "gold") {
  const s =
    tone === "green" ? "background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46" : tone === "navy" ? `background:${NAVY};color:#ffffff` : "background:#fffbeb;border:1px solid #fde68a;color:#78350f";
  return `<div style="${s};border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;margin:16px 0">${html}</div>`;
}

/** The full email: header with logo, content, footer */
export function layout(opts: { preheader: string; title: string; body: string }) {
  const header = logoUrl
    ? `<img src="${logoUrl}" width="120" alt="${esc(siteConfig.businessName)}" style="display:block;background:#ffffff;border-radius:10px;padding:6px;margin:0 auto 10px">`
    : `<div style="font-size:26px;font-weight:bold;color:#ffffff;letter-spacing:1px">${esc(siteConfig.businessName)}</div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 10px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td align="center" style="background:${NAVY};padding:26px 20px 18px">
      ${header}
      <div style="font-size:13px;color:${GOLD};font-weight:bold">${esc(siteConfig.tagline)}</div>
    </td></tr>
    <tr><td style="height:4px;background:${GOLD};line-height:4px;font-size:0">&nbsp;</td></tr>
    <tr><td style="padding:28px 24px 8px">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${NAVY}">${esc(opts.title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#334155">${opts.body}</div>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #f1f5f9;font-size:14px;line-height:1.5;color:#334155">
      Need help? Email us at <a href="mailto:${esc(siteConfig.email)}" style="color:${NAVY};font-weight:bold">${esc(siteConfig.email)}</a>
    </td></tr>
    <tr><td style="padding:0 24px 26px;font-size:12px;line-height:1.6;color:#94a3b8">
      ${esc(siteConfig.businessName)} · ${esc(siteConfig.nameMeaning)}<br>
      <a href="${esc(site)}" style="color:${NAVY}">${esc(site.replace(/^https?:\/\//, ""))}</a> · ${esc(siteConfig.email)}<br>
      All times are Indian Standard Time (IST).
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
