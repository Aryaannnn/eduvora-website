import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { emailLink, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `How cancellations, rescheduling and refunds work at ${siteConfig.businessName}.`,
};

// ✏️ The numbers (24 hours, 7 days, 5–7 working days) come from
//    src/config/site.ts → refunds. Change them there.
export default function RefundPolicyPage() {
  const r = siteConfig.refunds;
  const h = r.counsellingHours;
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>
        We want you to feel confident when you pay us. This page explains, in simple words, when you can reschedule, cancel or get
        a refund.
      </p>

      <h2>In short</h2>
      <ul>
        <li><strong>Counselling session:</strong> free reschedule or full refund up to {h} hours before your slot.</li>
        <li><strong>Courses, study material, papers and mock tests:</strong> non-refundable once you get access (they are digital products).</li>
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

      <h2>2. Crash courses, study material, previous year papers and mock tests</h2>
      <ul>
        <li>These are <strong>digital products</strong>. Once you get access (to the course, the files or the tests), they are <strong>non-refundable</strong>.</li>
        <li>
          <strong>Technical problem?</strong> If you paid but cannot open or download the content, tell us. We will fix the problem
          or give you a full refund <strong>within {r.techIssueDays} days</strong>.
        </li>
      </ul>

      <h2>3. How refunds are paid</h2>
      <p>
        Approved refunds are sent back to your <strong>original payment method</strong> (the same UPI, card or bank account, through
        Razorpay) within <strong>{r.processingTime}</strong>. Your bank may take a little longer to show it.
      </p>

      <h2>4. How to ask for a refund</h2>
      <p>
        Email us at <a href={emailLink}>{siteConfig.email}</a> and include:
      </p>
      <ul>
        <li>your <strong>Payment ID</strong> (you can find it in Dashboard → Payment History, on your invoice or in your payment email),</li>
        <li>your name and the phone number or email you used to sign up,</li>
        <li>what you bought and why you are asking for a refund.</li>
      </ul>
      <p>We reply within 2 working days.</p>

      <h2>5. When we cannot give a refund</h2>
      <ul>
        <li>The request is made after the time limits above.</li>
        <li>Your access was stopped because the Terms &amp; Conditions were broken (for example, sharing paid content).</li>
      </ul>
    </LegalPage>
  );
}
