// =====================================================================
//  THE WEBSITE'S ADDRESS (used for every full link we create)
//  Google login return, email confirmation, password reset, email
//  buttons, invoices, calendar links and link-preview images.
//
//  Order of choice:
//   1. NEXT_PUBLIC_SITE_URL   (set this in Vercel → your real address)
//   2. Vercel's production address (automatic on Vercel, as a backup)
//   3. http://localhost:3000  (only on your own computer)
//  ⚠️ NEXT_PUBLIC_ values are baked in when the site is built —
//     after changing it in Vercel, click "Redeploy".
// =====================================================================
const clean = (u?: string) => (u ?? "").trim().replace(/\/+$/, "");
const withHttps = (host?: string) => {
  const h = clean(host);
  return h ? (/^https?:\/\//.test(h) ? h : `https://${h}`) : "";
};

const configured = clean(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_URL =
  configured ||
  withHttps(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ||
  withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  "http://localhost:3000";

/**
 * Address to put in links that come BACK to the website (Google login,
 * email confirmation, password reset). Uses NEXT_PUBLIC_SITE_URL when set;
 * without it (e.g. on your computer) the address in the browser is used.
 */
export function appOrigin(): string {
  if (configured) return configured;
  return typeof window !== "undefined" ? window.location.origin : SITE_URL;
}

/** Same as appOrigin(), for server routes that know the incoming request. */
export function serverOrigin(requestOrigin: string): string {
  return configured || requestOrigin;
}
