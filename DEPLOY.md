# Putting EDUVORA online with Vercel

Follow these steps in order. You never need to put a secret value in the code. Every value goes into Vercel's **Environment Variables** screen.

---

## 1. Import the project

1. Go to **vercel.com**, sign in with GitHub and choose **Add New → Project**.
2. Pick the **eduvora-website** repository. The Framework preset should say **Next.js**. Leave the build settings as they are.
3. **Before** clicking Deploy, open **Environment Variables** and add every name from the list below.

## 2. Environment variables (names only)

Add each one for the **Production** environment. Add them for **Preview** too if you use preview links.

| Name | What it is | Secret? | Changes for the live site? |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your website address, e.g. `https://eduvora.in`, with no `/` at the end | no | **YES**: your real domain (or the `….vercel.app` address until you connect a domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | no | no (same Supabase project) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. Older projects use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead; you need only one of the two. | no | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key | **yes** | no |
| `RAZORPAY_KEY_ID` | Razorpay key id | no | **YES**: `rzp_live_…` instead of `rzp_test_…` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | The same key id again (for the payment popup) | no | **YES**: `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | **yes** | **YES**: the live secret |
| `RAZORPAY_WEBHOOK_SECRET` | The text you type when creating the webhook (step 4) | **yes** | **YES**: Live mode has its own webhook |
| `RESEND_API_KEY` | Resend → API Keys | **yes** | no |
| `ADMIN_EMAIL` | Where "new payment / booking / enquiry" alerts go | no | no |
| `CONTACT_PHONE` | Your full phone number (full number + Call button only for paid students; WhatsApp chat uses it for everyone) | **yes** | no |
| `NEXT_PUBLIC_GA_ID` | *Optional.* Google Analytics 4 Measurement ID (`G-…`). Leave it out to not use Google Analytics | no | no |
| `WHATSAPP_PHONE` | *Optional.* A separate number just for WhatsApp chat. Leave it out to use `CONTACT_PHONE` | no | no |
| `CRON_SECRET` | Any long random text (40+ characters) that protects the automatic jobs | **yes** | Use a new one for the live site (don't reuse the one on your computer) |

⚠️ Values that start with `NEXT_PUBLIC_` are baked in when the site is built. If you change one later, go to **Deployments → ⋯ → Redeploy**.

## 3. Supabase: allow the new address

Supabase → **Authentication → URL Configuration**:

- **Site URL:** your live address (the same as `NEXT_PUBLIC_SITE_URL`)
- **Redirect URLs → Add URL:** `https://YOUR-ADDRESS/**` (keep `http://localhost:3000/**` for your computer)

Without this, Google login, email confirmation and password-reset links won't work.
If you use Google login, nothing changes in Google Cloud. It still returns to Supabase.

Always open the site at the **same** address as `NEXT_PUBLIC_SITE_URL`. In Vercel → **Domains**, make `www.` redirect to the main address (or the other way round).

## 4. Razorpay webhook

Razorpay Dashboard → **Account & Settings → Webhooks → Add New Webhook**

- **Webhook URL:** `https://YOUR-ADDRESS/api/payments/webhook`
- **Secret:** the same text as `RAZORPAY_WEBHOOK_SECRET`
- **Events:** tick `payment.captured` and `payment.failed`

Do this once in **Test mode** and again in **Live mode** when you switch to live keys.

## 5. Automatic jobs (payment check + session reminders)

There are two protected addresses:

| Job | Address | What it does |
|---|---|---|
| Payment check | `/api/cron/payments` | Attempts left "pending" for over 30 min: checks Razorpay, then marks them paid / failed / abandoned |
| Reminders | `/api/cron/reminders` | Sends the 24-hour and 1-hour session reminder emails (each only once) |

Both refuse to run (401) unless the request carries the header `Authorization: Bearer <CRON_SECRET>`.

**Vercel Cron (already set up in `vercel.json`):** runs each job **once a day**, the most the free Hobby plan allows. Vercel adds the secret header automatically.

**Every 15 minutes, free, with cron-job.org** (needed for the 1-hour reminder):

1. Create a free account at **cron-job.org** → **Create cronjob**.
2. **Title:** `EDUVORA payments` · **URL:** `https://YOUR-ADDRESS/api/cron/payments`
3. **Execution schedule:** Every **15** minutes.
4. Open the **Advanced** tab → **Headers → Add**:
   - Key: `Authorization`
   - Value: `Bearer ` followed by your CRON_SECRET (the word Bearer, one space, then the secret)
5. Request method: **GET** → **Create**.
6. Repeat for `EDUVORA reminders` with the URL `https://YOUR-ADDRESS/api/cron/reminders`.
7. Click **Test run** on each one. You should see status **200** and a reply like `{"ok":true,…}`. A **401** means the header is wrong.

## 6. Analytics (see who visits and what they do)

**Vercel Analytics + Speed Insights** are already in the code — you only switch them on:

1. Vercel → your project → **Analytics** tab → **Enable**.
2. Vercel → your project → **Speed Insights** tab → **Enable**.
3. Redeploy once (Deployments → ⋯ → Redeploy). Data appears within minutes of the first visits.

**Google Analytics 4 (optional, free):**

1. analytics.google.com → **Admin → Create → Property** (time zone: India, currency: INR) → **Web** data stream with your address.
2. Copy the **Measurement ID** (`G-…`) → add it in Vercel as `NEXT_PUBLIC_GA_ID` → **Redeploy**.
3. GA4 → **Reports → Realtime** shows visits within seconds; **Reports → Engagement → Events** shows the events below (they appear after ~24 hours).
4. Optional: in GA4 **Admin → Events**, mark `payment_success` and `slot_booked` as **Key events** (conversions).

**Events the website sends** (never names, emails or phone numbers):

| Event | When |
|---|---|
| `sign_up` / `login` | account created / signed in (method: email, google or phone) |
| `buy_click` | a Buy / Enroll / Get package button is clicked |
| `payment_success` | the payment success page opens (amount + item type) |
| `slot_booked` | a counselling slot is booked (paid, credit or free) |
| `predictor_used` | the first prediction on a page (guest / free / full) |
| `free_resource` | a free item is unlocked or downloaded |
| `whatsapp_click`, `call_click`, `community_click` | WhatsApp / Call / WhatsApp community buttons |

Note: custom events in **Vercel** Analytics need Vercel's Pro plan — on the free Hobby plan Vercel shows page views, visitors, countries, devices and referrers, while **Google Analytics shows all the events for free**.

## 7. Pre-launch mode (hidden from Google)

The site is in **pre-launch mode**: every page tells search engines "noindex". Anyone with the link can still open it.

To launch publicly: open `src/config/launch.ts`, change `PRE_LAUNCH = true` to `false`, then commit and push.

## 8. After the first deploy: quick checks

- Open the site, sign up, log in and log out.
- Try "Forgot password". The email link should open your live address, not localhost.
- Make a test payment (with test keys). Check Admin → Payments and the emails.
- Test run both cron-job.org jobs (step 5).
