# Connecting the website to Supabase — step by step

Supabase is your **database + login system + file storage**. Follow these steps in order.
It takes about 20–30 minutes the first time.

---

## ✅ Part 1 — Create your Supabase project (5 min)

1. Go to **https://supabase.com** → click **Start your project** → sign in (GitHub or email).
2. Click **New project**.
   - **Name:** `eduvora` (anything you like)
   - **Database password:** click **Generate a password** → save it somewhere safe.
   - **Region:** **South Asia (Mumbai)** — fastest for Indian students.
3. Click **Create new project** and wait ~2 minutes until it says the project is ready.

## ✅ Part 2 — Put your keys in the website (3 min)

1. In Supabase, click the **Connect** button at the top (or **Project Settings → API Keys**).
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the **anon public** key (under "Legacy API keys") **or** the **Publishable key** (`sb_publishable_…`). Either one works.
   ⚠️ **Never** copy the `service_role` / secret key into the website.
4. Open the file **`.env.local`** in this project folder and paste them:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (your key)
   ```
5. Save. In the terminal press **Ctrl + C**, then run `npm run dev` again.

## ✅ Part 3 — Create the tables (2 min)

1. In Supabase, click **SQL Editor** (left menu) → **New query**.
2. Open **`supabase/setup.sql`** from this project, select everything (**Ctrl + A**), copy (**Ctrl + C**).
3. Paste into the SQL Editor and click **Run** (bottom right).
4. You should see **"Success. No rows returned"**.
5. Click **Table Editor** — you'll see `products`, `slots`, `reviews`, etc. with sample data.
6. Refresh your website — courses, study material, tests, slots and reviews now come from Supabase! 🎉

> Running the file again later is safe — it won't create duplicates.

## ✅ Part 4 — Tell Supabase where your website is (1 min)

1. **Authentication → URL Configuration**
2. **Site URL:** `http://localhost:3000` (change to `https://yourdomain.com` when you go live)
3. **Redirect URLs → Add URL:** `http://localhost:3000/**` (and later `https://yourdomain.com/**`) → **Save**

## ✅ Part 4b — Email + password login (already on)

Email login works out of the box. One choice to make in **Authentication → Sign In / Providers → Email**:

- **"Confirm email" OFF** (easiest while testing): new accounts can sign in immediately.
- **"Confirm email" ON** (recommended when live): students must click a link in an email first.
  Supabase's built-in email sender only sends a few emails per hour, so before going live set up your own
  email sender in **Project Settings → Authentication → SMTP Settings** (e.g. Resend, Brevo, Zoho).

**Which login buttons show on the website** is controlled in `src/config/site.ts` → `loginMethods`
(`email`, `google`, `phone`). Set one to `true` only after switching it on in Supabase.

## ✅ Part 4c — Forgot password (reset emails)

1. **Authentication → URL Configuration → Redirect URLs** must include `http://localhost:3000/**`
   (and later `https://yourdomain.com/**`). The reset link opens `/auth/callback`, then `/reset-password`.
2. Supabase's built-in email sender only sends **a few emails per hour** — fine for testing. Before going live,
   add your own sender in **Project Settings → Authentication → SMTP Settings** and set **Sender name** to `EDUVORA`.
3. *(Optional, recommended when live)* To let students open the reset email on a **different device** (e.g. request on
   laptop, open on phone), go to **Authentication → Email Templates → Reset Password** and change the link to:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```
   You can also edit the email text there (e.g. "Reset your EDUVORA password").

## ✅ Part 5 — Turn on Google sign-in (10 min)

After finishing the steps below, open `src/config/site.ts` and change `google: false` to `google: true`.

**A. In Google Cloud**
1. Go to **https://console.cloud.google.com** → create a project (top bar → **New Project**).
2. **APIs & Services → OAuth consent screen** → choose **External** → fill app name, your email → Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - **Application type:** Web application
   - **Authorized redirect URIs → Add URI:** `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
     (Supabase shows this exact address on the Google provider page — copy it from there.)
4. Click **Create** and copy the **Client ID** and **Client secret**.

**B. In Supabase**
1. **Authentication → Sign In / Providers → Google** → turn **Enable** on.
2. Paste the **Client ID** and **Client secret** → **Save**.

## ✅ Part 6 — Turn on phone (OTP) sign-in (10 min + SMS provider)

After finishing the steps below, open `src/config/site.ts` and change `phone: false` to `phone: true`.

1. **Authentication → Sign In / Providers → Phone** → turn **Enable** on.
2. Choose an **SMS provider** (Twilio, MessageBird, Vonage or Textlocal) and paste its keys.
   - 🇮🇳 **Important for India:** to send OTP SMS to Indian numbers, telecom rules (TRAI **DLT registration**)
     apply. Your SMS provider will guide you through registering your business name and OTP message template.
3. **Testing without SMS (free):** on the same Phone page, find **Test Phone Numbers and OTPs** and add e.g.
   `919999999999=123456`. Then on the website sign up with **9999999999** and enter **123456**.
4. **Save**.

## ✅ Part 7 — Make yourself the admin (1 min)

1. On your website, **Sign Up** with your own phone number or Google account.
2. In Supabase → **SQL Editor → New query**, run ONE of these (put your details):
   ```sql
   update public.profiles set role = 'admin' where phone = '919876543210';     -- phone: 91 + number, no +
   update public.profiles set role = 'admin' where email = 'YOUR-LOGIN-EMAIL';    -- or your Google email
   ```
3. Open **My Account** on the website — you'll see an **Admin** badge.

## ✅ Part 8 — Upload your paid PDFs (2 min per file)

The SQL already created a **private** bucket called **`materials`**.

1. **Storage → materials → Create folder** → `study-material` (and another called `previous-papers`).
2. Open the folder → **Upload file** → choose your PDF.
3. The file's path must match the product's **`file_path`** in the `products` table, e.g.
   `study-material/vit-vellore-kit.pdf`. (Rename your file to match, or edit `file_path` in Table Editor.)
4. Only students who **paid** for that product can download it (from **My Account → Download PDF**).

---

## 📋 Everyday tasks (in Supabase → Table Editor)

| I want to… | Do this |
| --- | --- |
| **Add a course / material / paper / test pack** | `products` → **Insert row**. `category` must be `crash_course`, `study_material`, `previous_paper` or `mock_test`. `slug` = short web name like `vit-chennai-kit-2027`. Price in rupees. |
| **Hide a product** | `products` → untick `is_active` |
| **Add counselling slots** | `slots` → **Insert row** → date, start_time (e.g. `10:00`), end_time, price |
| **See bookings** | `bookings` → each row shows the student, slot and status. Change `status` to `confirmed` / `completed`, `payment_status` to `paid`. |
| **Record a payment** (until Razorpay is connected) | `purchases` → **Insert row**: `user_id` (copy from `profiles`), `product_id` (copy from `products`), `amount`, `status` = `paid`. The student can now download the PDF / start the test. |
| **Add a review** | `reviews` → **Insert row** → name, type (`student`/`parent`), rating 1–5, comment, tick `is_approved` |
| **Add a test + questions** | `tests` → new row (link `product_id`, type `mock` or `mcq`, tick `is_free` for free tests). Then `questions` → new rows: `options` like `["A","B","C","D"]`, `correct_option` = **0** for the 1st option … **3** for the 4th. Total marks update automatically. |
| **Product display extras** | `products.details` (JSON): `short`, `badge`, `duration`, `mode`, `start_date`, `features`, `syllabus`, `includes`, `faqs`, `contents`, `format`, `color` (e.g. `"from-sky-600 to-cyan-500"`), `test_type` (`"mcq"` for MCQ packs), `questions_count`, `duration_label`. Copy a sample row to see the format. |

⏱️ Changes appear on the website within **about 1 minute** (pages are cached to stay fast).

## 🔒 What the security rules do

- Visitors can see only **active products, open slots and approved reviews**.
- Students can see **only their own** profile, purchases, bookings and test scores.
- Students **can't** make themselves admin, mark things as paid, confirm bookings, or fake test scores.
- Test answers **never** reach the browser before submitting — scoring happens in the database.
- Paid PDFs can only be downloaded by students who paid for them (60-second private links).
- Only **admins** can add/edit/delete products, slots, tests, questions and reviews.

## ⏭️ Not done yet

- **Razorpay checkout:** "Buy / Enroll" still opens WhatsApp. When Razorpay is connected, payments will
  create `purchases` rows automatically (with invoice numbers) — no manual step.
