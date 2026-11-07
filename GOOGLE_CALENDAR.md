# Google Calendar & Meet — one-time setup

When a counselling booking is confirmed (paid, free, or with a package credit), the website:

1. adds an event to **your** Google Calendar (eduvora.support@gmail.com) with the student's name, phone, class, expected marks and message;
2. creates a **Google Meet link** for it;
3. invites the student as a **guest**, so Google sends them a calendar invite too;
4. shows the Meet link in the student's **My Bookings**, the confirmation email, both reminder emails, and **Admin → Bookings** ("Join Meet").

If you **reschedule** a booking, the event moves (the student gets Google's "updated" email). If a booking is **cancelled** (by you or the student), the event is cancelled.

If Google Calendar is not connected or Google fails, the booking is **still confirmed**. The student sees "Meet link will be shared soon", and you see a yellow alert in Admin → Overview and Admin → Bookings, where you can paste a link by hand. The student is emailed when you save it. The website also tries again every 15 minutes (with the reminders job), and as soon as you connect.

---

## Step 1 — Turn on the Google Calendar API

1. Open <https://console.cloud.google.com> and sign in with the account that owns your project.
2. At the top, pick the project **eduvora**.
3. Menu ☰ → **APIs & Services → Library**.
4. Search **Google Calendar API** → open it → click **Enable**.

## Step 2 — Check the app is "In production"

1. Menu ☰ → **Google Auth Platform → Audience** (older screens: *OAuth consent screen*).
2. **Publishing status** should say **In production**. If it says **Testing**, click **Publish app** → **Confirm**.
   (In "Testing", Google switches off the calendar connection after 7 days.)

You do **not** need to submit the app for Google verification. Only you connect your calendar.

## Step 3 — Create a login key for the calendar

1. **Google Auth Platform → Clients** (older: *APIs & Services → Credentials*) → **+ Create client**.
2. **Application type:** Web application. **Name:** `EDUVORA Calendar`.
3. Under **Authorised redirect URIs** click **+ Add URI** twice and add:
   - `https://eduvora-counselling.vercel.app/api/admin/google/callback`
   - `http://localhost:3000/api/admin/google/callback` (for testing on your computer)
4. Click **Create**. Copy the **Client ID** and **Client secret** now (Google may not show the secret again, so you can also click **Download JSON** and keep it somewhere safe).

> Keep the Google sign-in client that Supabase uses as it is. This is a **separate** client.

## Step 4 — Add the two keys to Vercel (and your computer)

Vercel → your project → **Settings → Environment Variables** → add:

| Name | Value |
| --- | --- |
| `GOOGLE_CALENDAR_CLIENT_ID` | the Client ID (ends with `.apps.googleusercontent.com`) |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | the Client secret |

Then **Deployments → ⋯ → Redeploy**. Add the same two lines to `.env.local` on your computer.
Both are server-only. Never name them `NEXT_PUBLIC_…`.

## Step 5 — Run the SQL

Supabase → **SQL Editor → New query** → paste all of `supabase/google-calendar.sql` → **Run**.

## Step 6 — Connect your calendar (once)

1. Log in to the website as admin → **Admin → Settings → Google Calendar & Meet → Connect Google Calendar**.
2. Choose **eduvora.support@gmail.com**.
3. Google shows **"Google hasn't verified this app"**. This is normal for your own private app. Click **Advanced → Go to … (unsafe)**.
4. **Tick the box** "View and edit events on all your calendars" → **Continue**.
5. You're back in Settings with **✅ Connected**. Upcoming bookings without a link get one within a minute.

---

## How the key is kept safe

- Google gives the website a long-term key (a *refresh token*). It is stored **encrypted** in the table `google_calendar_connection`.
- That table has **no access** for students, admins in the browser or visitors. Only the website's server (service role) can read it.
- The encryption key comes from `GOOGLE_CALENDAR_CLIENT_SECRET`, which is only in Vercel. A copy of the database alone is useless.
- The key only allows **calendar events**. It can't read your Gmail or Drive.
- **Disconnect** (Admin → Settings) deletes it and also revokes it at Google. You can also remove access any time at <https://myaccount.google.com/permissions>.

## If something goes wrong

| You see | What to do |
| --- | --- |
| "Needs reconnecting" in Settings | Click **Reconnect**. This happens if you changed the Google password, removed access, or the app was in "Testing". |
| `redirect_uri_mismatch` on Google's page | The redirect URI in Step 3 must match your site address exactly (including `https://`). Also check `NEXT_PUBLIC_SITE_URL` in Vercel. |
| "Please tick the box…" | On Google's page, tick the calendar permission and continue. |
| A booking shows "No Meet link yet" | Click **Try Google again**, or paste any Meet/Zoom link and click **Save & email student**. |
| You changed the Client secret | Click **Reconnect** once. |
