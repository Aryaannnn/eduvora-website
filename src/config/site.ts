// =====================================================================
//  ⭐ YOUR BUSINESS DETAILS — THIS IS THE ONLY FILE YOU NEED TO EDIT ⭐
//  Change the values inside the quotes "..." and save the file.
//  The whole website (navbar, footer, buttons, contact page) updates.
// =====================================================================

import { founder as founderContent } from "@/content/founder";
import { SITE_URL } from "@/lib/site-url";

// ✏️ Your business email — shown everywhere (footer, contact page, policies, invoices,
//    dashboard Help) and used as the "Reply-To" of every email the website sends.
//    Unlike the phone number, this one is public.
const SUPPORT_EMAIL = "eduvora.support@gmail.com";

export const siteConfig = {
  // ---------- Business ----------
  businessName: "EDUVORA",
  tagline: "Discover Your Path, Build Your Future.",
  nameMeaning: "Education + Evolve + Aura", // small subtitle (About page + footer)
  logo: "/logo.png", // file in the "public" folder (full logo — white or light backgrounds only)
  logoAlt: "EDUVORA logo",
  description:
    "EDUVORA offers expert VITEEE counselling, crash courses, mock tests, a rank & college predictor and study material to help you get a better rank and the right VIT campus and branch.",

  // Your website's address. Set NEXT_PUBLIC_SITE_URL (in .env.local and in Vercel).
  // Used for link previews, email links, invoices and login redirects — see src/lib/site-url.ts
  siteUrl: SITE_URL,

  // Name shown on invoices and on the Razorpay payment window (when payments are connected)
  billingName: "EDUVORA",

  // ---------- Invoices (PDF) ----------
  invoice: {
    // ✏️ Your business address as it should appear on invoices
    //    (only printed when showAddress below is true)
    address: "Your business address, City, State, PIN",
    // ✏️ Your GST number. Leave EMPTY ("") if you don't have one — the GST line is then hidden.
    gstin: "",
    footerNote: "Thank you for choosing EDUVORA. This is a computer-generated invoice.",
  },

  // ---------- Product files (PDF / ZIP uploads) ----------
  uploads: {
    // Biggest file you can upload. Supabase FREE plan allows at most 50 MB per file.
    // On a paid plan: raise "Upload file size limit" in Supabase → Storage → Settings,
    // change file_size_limit in supabase/product-files.sql, and change this number.
    maxFileMB: 50,
    // Your plan's total storage (Free plan = 1 GB) — used for the "storage used" bar.
    storageLimitGB: 1,
  },

  // ---------- Emails (sent with Resend) ----------
  emailSender: {
    // ✏️ After verifying your own domain in Resend, change this to an address on that
    //    domain, written as  "EDUVORA <name@your-domain>". onboarding@resend.dev only
    //    delivers to the email address of your own Resend account (testing).
    from: "EDUVORA <onboarding@resend.dev>",
    replyTo: SUPPORT_EMAIL, // when a student replies to any email, it arrives here
  },

  // ---------- Founder ----------
  // ✏️ The founder's name, title, photo and story are edited in src/content/founder.ts
  founder: {
    name: founderContent.name,
    title: founderContent.shortTitle,
    photo: founderContent.photo,
    shortBio: founderContent.summary,
  },

  // ---------- Disclaimer ----------
  // ✏️ Shown in the footer of every page, on the About page, the Rank Predictor
  //    page and in the Terms & Conditions.
  disclaimer:
    "EDUVORA is an independent counselling and coaching platform. We are not affiliated with, associated with, or endorsed by Vellore Institute of Technology (VIT). VIT and VITEEE are names of their respective owners, used only for informational purposes.",

  // ---------- Contact ----------
  // 🔒 Your FULL phone/WhatsApp number is NOT stored here (this file is public).
  //    It lives in .env.local as CONTACT_PHONE and is only shown to students who
  //    have paid (checked on the server — see src/lib/contact.ts).
  //    Only the masked version below is public:
  phoneMasked: "+91 93440 XXXXX",
  whatsappMessage: "Hi, I need help with VITEEE counselling",
  email: SUPPORT_EMAIL,
  // 📍 Address is HIDDEN everywhere (footer, contact page, invoices).
  //    To show it again: write your real address below and set showAddress: true
  showAddress: false,
  address: "Your office address, City, State, PIN",
  officeHours: "Mon – Sat, 10:00 AM – 8:00 PM",

  // ---------- Social media ----------
  instagram: "https://www.instagram.com/utkarsh_unfolded",
  instagramHandle: "@utkarsh_unfolded",
  youtube: "https://youtube.com/@utkarsh_shrivastava_1819",
  youtubeHandle: "@utkarsh_shrivastava_1819",

  // ---------- Results numbers ----------
  // These now live in the database — edit them in Admin → Settings.
  // A number left empty is hidden on the website.

  // ---------- Refund & Cancellation rules ----------
  // ✏️ Change the numbers / sentences here — the Refund Policy page and the
  //    short notes next to every "Buy Now" and "Pay & Book Slot" button update.
  refunds: {
    // Counselling sessions
    counsellingHours: 24, // free reschedule / full refund up to this many hours before the slot
    // Digital products (crash courses, study material, previous year papers, mock tests)
    techIssueDays: 7, // we fix the problem or refund within this many days
    processingTime: "5–7 working days", // how long a refund takes to reach the student
    // Short notes shown next to the payment buttons
    counsellingNote: "Free reschedule or full refund up to 24 hours before your slot. No refund within 24 hours or if the session is missed.",
    digitalNote: "Digital product — non-refundable once access is given. If you can't access it, we'll fix it or refund within 7 days.",
  },

  // Date shown on the policy pages
  policiesUpdated: "5 November 2026",

  // ---------- Login options (true = shown on the login page) ----------
  // Turn one on ONLY after switching it on in Supabase → Authentication → Sign In / Providers.
  loginMethods: {
    email: true, // email + password
    google: false, // "Continue with Google" — set to true after Google setup (see SUPABASE_SETUP.md Part 5)
    phone: false, // mobile number + OTP — set to true after SMS setup (see SUPABASE_SETUP.md Part 6)
  },
};

// ---------------------------------------------------------------------
//  Helper links (you normally don't need to change anything below)
// ---------------------------------------------------------------------
// These links do NOT contain your number. They go to small server routes
// (src/app/go/...) that check if the student has paid:
//   paid  → opens WhatsApp / the phone dialer with your real number
//   not paid → shows the "Unlock Direct Call & WhatsApp" page instead
export function whatsappLink(message: string = siteConfig.whatsappMessage) {
  return `/go/whatsapp?text=${encodeURIComponent(message)}`;
}

export const phoneLink = "/go/call";
export const unlockLink = "/unlock";
export const emailLink = `mailto:${siteConfig.email}`;

// "Buy Now" / "Enroll Now" buttons use Razorpay — see src/components/BuyButton.tsx
