# Error monitoring with Sentry

Sentry tells you (by email) when something breaks on the website, especially
**payments, bookings, emails and logins**. It is **off** until you add the DSN,
so your computer (localhost) works without it.

**What is never sent to Sentry:** names, emails, phone numbers, payment or
card/UPI details, Razorpay ids, login cookies, IP addresses or private
parent links. Every report is cleaned first (`src/lib/sentry-scrub.ts`), for
example "Payment failed for riya@gmail.com" becomes "Payment failed for [email]".

---

## Step 1 — Create a free Sentry account

1. Open <https://sentry.io/signup/> and sign up with **eduvora.support@gmail.com**
   (or "Continue with Google" using that account).
2. Organization name: `eduvora`. Data storage location: choose **US** or **EU** (either is fine).
3. The free **Developer** plan is enough (5,000 errors a month, email alerts included).

## Step 2 — Create the project

1. When Sentry asks you to **Create a project**, choose the platform **Next.js**.
2. "Set your alert frequency": choose **Alert me on every new issue**.
3. Project name: `eduvora-website` → **Create Project**.
4. Sentry then shows set-up instructions with a "wizard" command. **Skip all of that**; the
   code is already set up. Just continue to the next step.

## Step 3 — Get the 4 values

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | **Settings → Projects → eduvora-website → Client Keys (DSN)** → copy the **DSN** (looks like `https://abc123@o12345.ingest.sentry.io/67890`) |
| `SENTRY_ORG` | **Settings → General Settings → Organization Slug** (also the first part of your Sentry address, e.g. `eduvora` in `eduvora.sentry.io`) |
| `SENTRY_PROJECT` | The project slug: `eduvora-website` |
| `SENTRY_AUTH_TOKEN` | **Settings → Developer Settings → Organization Tokens → Create New Token** (name it `vercel-build`) → **copy it now**, it's shown only once |

The DSN is not a secret (it only lets the website *send* errors). The auth token **is a secret**:
it is only used during the Vercel build to upload "source maps", so error reports show the
exact line of code. The maps are deleted after uploading, so they're never public.

## Step 4 — Add them to Vercel

Vercel → your project → **Settings → Environment Variables → Add Environment Variable**:

| Key | Type | Environments |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Config | Production (and Preview if you like) |
| `SENTRY_ORG` | Config | Production, Preview |
| `SENTRY_PROJECT` | Config | Production, Preview |
| `SENTRY_AUTH_TOKEN` | **Secret** | Production, Preview |

Then **Deployments → ⋯ → Redeploy**.

Leave them **out of `.env.local`** on your computer. That way Sentry stays off while you work locally.

## Step 5 — Extra privacy switches in Sentry (recommended)

**Settings → Security & Privacy** (organization) and **Settings → Projects → eduvora-website → Security & Privacy**:

- **Data Scrubber**: ON
- **Use Default Scrubbers**: ON
- **Prevent Storing of IP Addresses**: ON

(The website already removes personal data; these are a second safety net.)

## Step 6 — Email alerts

### A. Instant alert for payments, bookings, emails and logins
1. **Alerts → Create Alert → Issues** (or "Errors") → **Set Conditions**.
2. **When:** "A new issue is created" **and** add "The issue changes state from resolved to unresolved".
3. **If (filter):** "The event's **tags** match" → key `critical`, **equals**, value `yes`.
4. **Then:** "Send a notification to **Member** → (you)" — email.
5. Action interval: **5 minutes**. Name: `🚨 Critical: payment / booking / email / login`. **Save Rule**.

Every critical report carries a tag `area` (`payment`, `booking`, `email`, `login` or `calendar`),
so the email tells you which part failed.

### B. "Something is failing a lot" alert (all errors)
1. **Alerts → Create Alert → Issues**.
2. **When:** "The issue is seen more than **10** times in **1 hour**".
3. **Then:** email you. Name: `Many errors`. **Save Rule**.

### C. Make sure emails reach you
**User Settings (your avatar) → Notifications → Issue Alerts → On**, and check that your email
address is verified. Add `noreply@md.getsentry.com` to your contacts so alerts don't go to spam.

## Step 7 — Test it

After the redeploy, open this address once (it simulates a broken Google sign-in, harmless):

```
https://eduvora-counselling.vercel.app/auth/callback?error=server_error&error_code=sentry_test
```

Within a minute you should see an issue **"[login] Sign-in link / Google sign-in returned an
error…"** in Sentry → **Issues**, and get the 🚨 email. Then click **Resolve** on it.

---

## What is tracked

| Area | Examples |
| --- | --- |
| **payment** | Razorpay order couldn't be created; payment signature check failed; webhook signature wrong (wrong `RAZORPAY_WEBHOOK_SECRET`); amount mismatch; a PAID purchase couldn't be saved |
| **booking** | slot couldn't be held; booking order failed; a PAID booking couldn't be confirmed; package-credit booking failed |
| **email** | any email (receipt, booking confirmation, reminder, feedback…) that Resend couldn't send |
| **login** | Supabase down, sign-up/OTP/reset emails or SMS failing, rate limit reached, Google sign-in misconfigured (wrong passwords are **not** reported) |
| **calendar** | Google Calendar / Meet link couldn't be created |

Plus every unexpected crash on any page (browser and server). Visitors then see a friendly page:
*"Something went wrong. Please try again, or contact eduvora.support@gmail.com."*

To turn Sentry off: delete `NEXT_PUBLIC_SENTRY_DSN` in Vercel and redeploy.
