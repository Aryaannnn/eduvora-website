import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { emailLink, siteConfig } from "@/config/site";
import { getOpenContact } from "@/lib/contact";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Shipping & Delivery Policy",
  description: "EDUVORA sells digital services only — no physical shipping. How and when you get access to counselling, PDF crash courses, study material and tests after payment.",
  path: "/shipping-policy",
});

// ✏️ Hours, email and refund rules come from src/config/site.ts.
//    The phone number is shown when Admin → Settings → Contact mode is "Open".
export default async function ShippingPolicyPage() {
  const open = await getOpenContact();
  return (
    <LegalPage title="Shipping & Delivery Policy" path="/shipping-policy">
      <p>
        {siteConfig.businessName} provides <strong>digital services only</strong>: VITEEE counselling, study material, previous year
        papers, mock tests and PDF crash courses (Formula Book and Question Bank included). <strong>Nothing is shipped physically</strong> — there are no delivery charges
        and no courier.
      </p>

      <h2>1. When you get access</h2>
      <ul>
        <li>Access is given in your <strong>dashboard</strong> (My Courses &amp; Material) <strong>right after a successful payment</strong>.</li>
        <li>If there is a delay on the payment side, access is given <strong>within 24 hours</strong>. You don&apos;t need to pay again.</li>
        <li>Your invoice is available in your dashboard (Payment History).</li>
      </ul>

      <h2>2. How each service is delivered</h2>
      <ul>
        <li>
          <strong>Study material, previous year papers and guides:</strong> delivered as a <strong>personal PDF watermarked with your
          name, phone number and email</strong> — open it in your browser or download it from your dashboard. Once opened or
          downloaded it is non-refundable. Sharing it is not allowed; every copy can be traced to the account.
        </li>
        <li><strong>Mock tests:</strong> taken online in your dashboard.</li>
        <li>
          <strong>Counselling:</strong> a 30-minute one-to-one <strong>voice call</strong> at the date and time you booked (India time).{" "}
          {siteConfig.founder.name.split(" ")[0]} Sir calls you on the number you gave when booking.
        </li>
        <li><strong>Crash courses, Formula Book and Question Bank:</strong> chapter-wise PDF notes for Physics, Chemistry and Mathematics, available in your dashboard right after payment.</li>
      </ul>

      <h2>3. Didn&apos;t get access?</h2>
      <p>
        Contact us with your <strong>Payment ID</strong> (from Razorpay, your dashboard or the payment page) and we&apos;ll fix it quickly:
      </p>
      <ul>
        <li>Email: <a href={emailLink}>{siteConfig.email}</a></li>
        {open ? (
          <li>Phone / WhatsApp: <a href={`tel:${open.tel}`}>{open.display}</a></li>
        ) : (
          <li>Phone: send us a <Link href="/contact#enquiry">free enquiry</Link> and we&apos;ll call you back</li>
        )}
        <li>Hours: {siteConfig.officeHours} (India time)</li>
      </ul>
      <p>
        If we can&apos;t give you access, you get a refund as described in our{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
      </p>
    </LegalPage>
  );
}
