# private-assets (server only)

Files here are read by the website's **server** (for example when it makes a PDF
invoice). They are **not** in `public/`, so Next.js never serves them at a web
address, and `next.config.ts` (outputFileTracingIncludes) packs them for Vercel.

- `signature.png` — the signature on invoices ("Authorised Signatory").
  Transparent PNG, any size (it is printed about 45 mm wide).
  Switch it off with `invoice.showSignature` in `src/config/site.ts`.

⚠️ This repository is PUBLIC on GitHub. Anything committed here can be downloaded
by anyone from github.com. To keep the signature private, either make the
repository private (GitHub → Settings → General → Danger Zone → Change visibility)
or don't commit it here and upload it to the private Supabase Storage bucket
"assets" instead (the website reads it from there automatically).
