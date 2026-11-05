# EDUVORA – VITEEE Counselling & Coaching Website

*Discover Your Path, Build Your Future.*

Built with Next.js (App Router) + Tailwind CSS.

## How to run it on your computer

1. Install **Node.js** (LTS version) from https://nodejs.org (only once, if you don't have it).
2. Open a terminal in this folder (`Viteee-Website`).
   In VS Code: **Terminal → New Terminal**.
3. First time only, install the packages:
   ```
   npm install
   ```
4. Start the website:
   ```
   npm run dev
   ```
5. Open **http://localhost:3000** in your browser. Saved changes appear automatically.
6. To stop it, click in the terminal and press **Ctrl + C**.

**See it on your phone:** connect your phone to the same Wi-Fi as the computer, run `ipconfig`
in a terminal, note the "IPv4 Address" (e.g. 192.168.1.5), and open `http://192.168.1.5:3000` on the phone.

## ⭐ Change your phone number & business details

Edit **one file: `src/config/site.ts`**

It has the business name, logo letters, founder name/bio/photo, phone, WhatsApp number,
WhatsApp message, email, address, office hours, Instagram, YouTube and the results numbers.

- `phone` → shown on the site and used by the "Call Now" button. Example: `"+91 98765 43210"`
- `whatsappNumber` → country code + number, **no + and no spaces**. Example: `"919876543210"`
- Founder photo: put `founder.jpg` in the `public` folder, then set `photo: "/founder.jpg"`.

## Supabase (database, login, files)

Courses, study material, tests, slots, bookings, reviews and student accounts live in **Supabase**.
👉 Follow **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** step by step to connect it.

- Your Supabase keys go in **`.env.local`** (private — never uploaded to GitHub).
- The whole database is created by **`supabase/setup.sql`** (paste it into Supabase → SQL Editor → Run).
- You add/edit products, slots, reviews and questions in **Supabase → Table Editor** (no code needed).

## Other files you may edit

| What | File |
| --- | --- |
| Home page FAQs | `src/data/misc.ts` |
| Hero slideshow text | `src/components/home/HeroSlider.tsx` (top of file) |
| Founder story (About page) | `src/app/about/page.tsx` (top of file) |
| Colours | top of `src/app/globals.css` |

## Before going live

- Replace all placeholders (phone, WhatsApp, email, address, social links, results).
- Replace the SAMPLE reviews in Supabase → `reviews` with real ones.
- "Buy Now" / "Enroll Now" still open WhatsApp — Razorpay checkout is the next step.
- Get the policy pages reviewed by a legal professional.
- Check the production build works: `npm run build`
