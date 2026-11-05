import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { emailLink, siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Refund & Cancellation Policy" };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>We want every student and parent to feel confident when they pay us. This policy explains how cancellations and refunds work.</p>

      <h2>1. Counselling slots</h2>
      <ul>
        <li><strong>Reschedule:</strong> free, once, if requested at least 12 hours before your slot.</li>
        <li><strong>Cancel 24+ hours before the slot:</strong> full refund.</li>
        <li><strong>Cancel less than 24 hours before the slot:</strong> 50% refund.</li>
        <li><strong>Missed slot without notice:</strong> no refund.</li>
        <li>If we need to cancel your slot, you can choose a full refund or a new slot at no extra cost.</li>
      </ul>

      <h2>2. Crash courses</h2>
      <ul>
        <li><strong>Before the batch starts:</strong> full refund, minus a processing fee of ₹500.</li>
        <li><strong>Within 3 days of the batch start date:</strong> 50% refund.</li>
        <li><strong>After 3 days of the batch start date:</strong> no refund.</li>
      </ul>

      <h2>3. Study material</h2>
      <ul>
        <li>Digital (PDF) material cannot be refunded once it has been sent.</li>
        <li>Printed material can be cancelled for a full refund before it is shipped.</li>
        <li>Damaged or wrong items will be replaced free of charge if reported within 48 hours of delivery.</li>
      </ul>

      <h2>4. Mock tests, MCQ tests and previous year papers</h2>
      <p>Refunds are available within 48 hours of purchase if no test or paper has been opened. After that, the fee is non-refundable.</p>

      <h2>5. How to request a refund</h2>
      <p>
        Email <a href={emailLink}>{siteConfig.email}</a> or WhatsApp us (the number is in your Dashboard → Help) with your name, registered phone
        number, what you purchased, and your payment ID. Approved refunds are sent to the original payment method (via Razorpay)
        within 5–7 working days.
      </p>

      <h2>6. Non-refundable cases</h2>
      <ul>
        <li>Access suspended due to violation of our Terms & Conditions.</li>
        <li>Requests made after the time limits above.</li>
      </ul>
    </LegalPage>
  );
}
