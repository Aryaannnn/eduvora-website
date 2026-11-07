import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { siteConfig as site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy", description: `How ${site.businessName} collects, uses, shares and protects your personal data.` };

// ⚠️ IMPORTANT: This policy is a well-meant starting point, NOT legal advice.
//    Have it reviewed by a legal professional (India: Digital Personal Data
//    Protection Act, 2023 and the IT Act/Rules) before launch, and update
//    "policiesUpdated" in src/config/site.ts whenever you change it.
//    (The yellow note at the top of the page comes from src/components/LegalPage.tsx —
//    remove it there once a lawyer has approved the text.)
export default function PrivacyPolicyPage() {
  const founder = site.founder.name;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {site.businessName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides VITEEE counselling, courses, study material, tests and a
        rank predictor. This policy explains, in simple words, what personal data we collect, why, who we share it with, how long we keep
        it, and the choices you have. It is written with India&apos;s <strong>Digital Personal Data Protection Act, 2023</strong> in mind.
        By creating an account you agree to this policy and our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>.
      </p>

      <h2>1. What data we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address, mobile number, whether you are a student or parent, and how you sign in (email, Google or phone).</li>
        <li><strong>Counselling bookings:</strong> student name, phone, email, class/year, expected VITEEE marks, your message and the slot you booked.</li>
        <li><strong>Payments:</strong> payments are handled by <strong>Razorpay</strong>. We receive the amount, item, payment and order IDs, payment method type (e.g. UPI or card) and status. <strong>We never see or store your card number, UPI PIN or bank passwords.</strong></li>
        <li><strong>Learning data:</strong> test answers and scores, rank predictions (marks or rank you enter), and which study files you download (with date and an anonymous device code).</li>
        <li><strong>Enquiries, reviews and session feedback</strong> you send us (your rating and answers after a counselling session). Feedback is shown on the website only if you tick the box allowing it — then only your first name, rating and &ldquo;What helped you most?&rdquo;.</li>
        <li><strong>Referrals and rewards:</strong> your referral code, who joined with your link, coupon uses and reward credit.</li>
        <li><strong>Technical data:</strong> pages visited, device and browser type, approximate location (country/city) and page speed — collected automatically (see Cookies below).</li>
        <li><strong>Consent record:</strong> the date you accepted this policy and our Terms.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To create and secure your account and let you log in.</li>
        <li>To provide what you asked for: counselling sessions, courses, study material, tests, the rank predictor and support.</li>
        <li>To process payments, send receipts and invoices, and handle refunds.</li>
        <li>To send important messages about your bookings and purchases (email, SMS, call or WhatsApp) and, if you join, community updates.</li>
        <li>To protect our study material (downloaded PDFs are personalised with your name, email and a download ID) and prevent misuse.</li>
        <li>To understand which pages help students and improve the website (analytics).</li>
        <li>To meet legal duties, such as keeping tax and accounting records.</li>
      </ul>
      <p>We do <strong>not</strong> sell your personal data, and we do not use it for advertising.</p>

      <h2>3. Who we share it with</h2>
      <p>Only with trusted service providers who help us run the website, and only what they need:</p>
      <ul>
        <li><strong>Razorpay</strong> — payment processing.</li>
        <li><strong>Supabase</strong> — our database, login system and secure file storage.</li>
        <li><strong>Resend</strong> — sending emails (receipts, booking confirmations, reminders).</li>
        <li><strong>Vercel</strong> — hosting the website, plus Vercel Web Analytics and Speed Insights.</li>
        <li><strong>Google</strong> — if you choose &ldquo;Continue with Google&rdquo; (sign-in); Google Analytics if we turn it on; and <strong>Google Calendar &amp; Google Meet</strong> for counselling sessions (your name, phone, email, class, expected marks and message are added to our calendar event, and you are invited as a guest).</li>
      </ul>
      <p>
        Some of these providers may store or process data on servers outside India. We may also share data if required by law or to
        protect our rights and users.
      </p>

      <h2>4. How long we keep it</h2>
      <ul>
        <li><strong>Account and learning data:</strong> while your account is active. When you delete your account, it is deleted (see section 6).</li>
        <li><strong>Payment and invoice records:</strong> kept for as long as Indian tax and accounting laws require (currently up to 8 years), even after account deletion — but without your name, email or phone.</li>
        <li><strong>Enquiries:</strong> only as long as needed to help you; we review and delete old enquiries regularly (we aim for no longer than 2 years), or sooner if you ask.</li>
        <li><strong>Download records and email logs:</strong> kept for security and support, and deleted when no longer needed (we aim for no longer than 2 years).</li>
        <li><strong>Backups:</strong> encrypted database backups are kept for up to 30 days, then deleted automatically.</li>
        <li><strong>Analytics:</strong> stored by our analytics providers in combined form, without your name, email or phone.</li>
      </ul>

      <h2>5. Your rights and choices</h2>
      <ul>
        <li><strong>See your data:</strong> Dashboard → My Profile → <strong>Download my data</strong> gives you a file with your data.</li>
        <li><strong>Correct it:</strong> edit your name and phone in My Profile, or ask us.</li>
        <li><strong>Delete it:</strong> see section 6.</li>
        <li><strong>Withdraw consent:</strong> you can stop using the service and delete your account at any time.</li>
        <li><strong>Complain:</strong> contact us first (section 11). You may also approach the Data Protection Board of India once it is available.</li>
      </ul>

      <h2>6. How to delete your account</h2>
      <p>
        Go to <strong>Dashboard → My Profile → Delete my account</strong>, type DELETE and confirm. Or email{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> from your registered email address and we will do it for you.
      </p>
      <p>
        We delete your login, profile, rank predictions, test results, enquiries, reviews, credits and referrals. Payment and invoice
        records are kept for tax purposes (section 4) with your name, email and phone removed. You will receive a confirmation email.
      </p>

      <h2 id="cookies">7. Cookies and analytics</h2>
      <ul>
        <li><strong>Essential cookies</strong> keep you logged in and secure (for example your login session and a security timer for admins). The website cannot work without them.</li>
        <li><strong>Small settings</strong> are stored in your browser, such as whether you have seen the cookie notice.</li>
        <li><strong>Analytics:</strong> Vercel Web Analytics and Speed Insights count page visits and loading speed without cookies. If Google Analytics is turned on, it may use cookies to tell visits apart; we switch off its advertising features.</li>
        <li><strong>We never send your name, email or phone to analytics tools</strong>, and page addresses are sent without extra codes.</li>
      </ul>
      <p>You can block or delete cookies in your browser settings, or use an add-on that blocks analytics. Blocking essential cookies will log you out.</p>

      <h2>8. How we protect your data</h2>
      <p>
        Data is sent over encrypted connections (HTTPS). Access to the database is restricted by strict permission rules, admin accounts need
        two-step verification, admin actions are logged, and backups are encrypted. No system is 100% secure, but we work hard to protect your data
        and will inform you and the authorities as required by law if a serious data breach affects you.
      </p>

      <h2>9. Children</h2>
      <p>
        Many of our students are under 18. If you are under 18, please use our services with the knowledge and consent of a parent or guardian,
        who may contact us about the student&apos;s data at any time. We do not use children&apos;s data for advertising or behaviour tracking.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>We may update this policy. The latest version and its date are always on this page. If we make important changes, we will ask you to accept them again.</p>

      <h2>11. Contact and grievances</h2>
      <p>
        For any privacy question, data request or complaint, contact our grievance contact <strong>{founder}</strong> at{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a> or through our <Link href="/contact">contact page</Link>. We aim to reply within 7 days.
      </p>
    </LegalPage>
  );
}
