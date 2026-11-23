import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { siteConfig as site } from "@/config/site";

export const metadata: Metadata = pageMeta({ title: "Terms & Conditions of Use", description: "The terms for using EDUVORA's VITEEE counselling, courses, study material, mock tests and rank predictor, including payments and accounts.", path: "/terms-and-conditions" });

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" path="/terms-and-conditions">
      <p>
        By using the {site.businessName} website or enrolling in any of our courses, you agree to these terms. Please read
        them carefully.
      </p>

      <h2>1. About our services</h2>
      <p>
        <strong>Disclaimer:</strong> {site.disclaimer}
      </p>
      <p>We do not guarantee any rank, score, seat or admission.</p>

      <h2>2. Enrolment and fees</h2>
      <ul>
        <li>Enrolment is confirmed only after full payment (or the first instalment, where allowed) is received.</li>
        <li>Fees shown on the website may change. The fee at the time of enrolment applies.</li>
        <li>Refunds are handled as described in our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</li>
      </ul>

      <h2>3. Course access</h2>
      <ul>
        <li>Online course access is for the enrolled student only and must not be shared.</li>
        <li>
          <strong>Access period:</strong> each course, book or material has an access period shown on its page, at checkout and on
          your invoice — for example &ldquo;1 year from enrolment&rdquo;, &ldquo;until 31 Aug 2027&rdquo; or &ldquo;Lifetime&rdquo;. It is
          counted from the date your payment is confirmed (or until the fixed date shown).
        </li>
        <li>
          When the access period ends, the item stays listed in your dashboard as &ldquo;Access expired&rdquo;, but its PDFs, class links
          and tests can no longer be opened or downloaded. We remind you in your dashboard 7 days before access ends. Where renewal is
          offered, you can renew from your dashboard; we may also extend access at our discretion.
        </li>
        <li>We may change class timings, faculty or schedules when needed, and will inform students in advance.</li>
      </ul>

      <h2>4. Study material and content</h2>
      <p>
        All notes, videos, tests and other material are our property and are for personal study only. Copying,
        recording, selling or sharing them without written permission is not allowed.
      </p>
      <p>
        Study material, previous year papers and other PDFs are delivered as a <strong>personal PDF</strong> (open it in your
        browser or download it) for your own study only. Every page is watermarked with your name, phone number, email,
        the date and a copy ID, and every open and download is logged, so shared copies can be traced to the account.
        Sharing, selling or uploading these files, or your login, is not allowed. Once a PDF is opened or downloaded it is
        non-refundable. An account can be signed in on up to 2 devices at a time; signing in on a third device signs out
        the oldest one. We may suspend accounts that share material.
      </p>

      <h2>5. Student conduct</h2>
      <p>
        Students must behave respectfully in classes and online groups. We may suspend or cancel access without
        refund in cases of misconduct, sharing of content or misuse of our platforms.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        We work hard to give accurate guidance, but final admission decisions are made by the university. We are
        not responsible for any loss arising from admission results, changes in exam rules or technical issues
        beyond our control.
      </p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of India. Any disputes are subject to the courts of our city of registration.</p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${site.email}`}>{site.email}</a> or use the contact page (<a href="/contact">/contact</a>).
        How access to our digital services is given after payment is explained in the{" "}
        <a href="/shipping-policy">Shipping &amp; Delivery Policy</a>; refunds in the <a href="/refund-policy">Refund &amp; Cancellation Policy</a>.
      </p>
    </LegalPage>
  );
}
