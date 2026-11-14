import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import LegalPage from "@/components/LegalPage";
import { emailLink, siteConfig } from "@/config/site";

export const metadata: Metadata = pageMeta({ title: "Refund & Cancellation Policy", description: "How cancellations, rescheduling and refunds work for EDUVORA counselling sessions, live crash courses and study material, with timelines and conditions.", path: "/refund-policy" });

// ✏️ The numbers (24 hours, 3 days, 7 days, 5–7 working days) come from
//    src/config/site.ts → refunds. Change them there.
export default function RefundPolicyPage() {
  const r = siteConfig.refunds;
  const h = r.counsellingHours;
  const d = r.liveBatchDays;
  return (
    <LegalPage title="Refund & Cancellation Policy" path="/refund-policy">
      <p>
        We want you to feel confident when you pay us. This page explains, in simple words, when you can reschedule, cancel or get
        a refund.
      </p>

      <h2>In short</h2>
      <ul>
        <li><strong>Counselling session:</strong> free reschedule or full refund up to {h} hours before your slot.</li>
        <li><strong>Live crash courses / batches:</strong> refund up to {d} days before the batch starts; full refund if we cancel the batch. Once classes begin, no refund.</li>
        <li><strong>Study material (PDFs), previous year papers and mock test packs:</strong> non-refundable once you get access (they are digital products).</li>
        <li><strong>Can&apos;t access what you paid for?</strong> We fix it or refund you within {r.techIssueDays} days.</li>
        <li><strong>Refunds</strong> go back to your original payment method within {r.processingTime}.</li>
      </ul>

      <h2>1. Counselling sessions</h2>
      <ul>
        <li><strong>Reschedule for free</strong> up to {h} hours before your slot.</li>
        <li><strong>Cancel more than {h} hours before</strong> your slot: you get a <strong>full refund</strong>.</li>
        <li><strong>Cancel within {h} hours</strong> of your slot: <strong>no refund</strong>.</li>
        <li><strong>Miss the session</strong> without telling us: <strong>no refund</strong>.</li>
        <li>If <strong>we</strong> have to cancel your session, you can choose a new time or a full refund.</li>
      </ul>

      <h2>2. Live crash courses and batches</h2>
      <ul>
        <li><strong>Cancel {d} or more days before the batch starts</strong>: you get a <strong>full refund</strong>.</li>
        <li><strong>Less than {d} days before</strong> the start, or <strong>once classes have begun</strong>: <strong>no refund</strong>.</li>
        <li>If <strong>we</strong> cancel the batch, you get a <strong>full refund</strong> (or you can move to the next batch if you prefer).</li>
      </ul>

      <h2>3. Study material, previous year papers and mock test packs</h2>
      <ul>
        <li>These are <strong>digital products</strong>. Once you get access (to the files or the tests), they are <strong>non-refundable</strong>.</li>
        <li>
          <strong>Technical problem?</strong> If you paid but cannot open or download the content, tell us. We will fix the problem
          or give you a full refund <strong>within {r.techIssueDays} days</strong>.
        </li>
      </ul>

      <h2>4. How refunds are paid</h2>
      <p>
        Approved refunds are sent back to your <strong>original payment method</strong> (the same UPI, card or bank account, through
        Razorpay) within <strong>{r.processingTime}</strong>. Your bank may take a little longer to show it.
      </p>

      <h2>5. How to ask for a refund</h2>
      <p>
        Email us at <a href={emailLink}>{siteConfig.email}</a> and include:
      </p>
      <ul>
        <li>your <strong>Payment ID</strong> (you can find it in Dashboard → Payment History, on your invoice or in your payment email),</li>
        <li>your name and the phone number or email you used to sign up,</li>
        <li>what you bought and why you are asking for a refund.</li>
      </ul>
      <p>We reply within 2 working days.</p>

      <h2>6. When we cannot give a refund</h2>
      <ul>
        <li>The request is made after the time limits above.</li>
        <li>Your access was stopped because the Terms &amp; Conditions were broken (for example, sharing paid content).</li>
      </ul>
    </LegalPage>
  );
}
