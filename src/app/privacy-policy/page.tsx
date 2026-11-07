import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { siteConfig as site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {site.businessName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) respects your privacy. This policy explains what
        information we collect when you use our website or join our courses, and how we use and protect it.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>Details you give us, such as your name, phone number, email address, school, class and course interest.</li>
        <li>Parent or guardian contact details, if provided.</li>
        <li>Academic information such as test scores and VITEEE rank, when you use our counselling services.</li>
        <li>Basic technical information such as browser type, device type, approximate country/city and pages visited, collected automatically (see &ldquo;Website analytics&rdquo; below).</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To respond to your enquiries and provide counselling.</li>
        <li>To enrol you in courses and share class schedules, study material and test results.</li>
        <li>To send important updates about your course by phone, SMS, email or WhatsApp.</li>
        <li>To improve our website and services.</li>
      </ul>

      <h2>3. Website analytics</h2>
      <p>
        To understand how our website is used and to make it faster, we use <strong>Vercel Web Analytics</strong> and{" "}
        <strong>Vercel Speed Insights</strong>, and we may use <strong>Google Analytics 4</strong>. These tools collect
        information such as the pages you visit, the type of device and browser, your approximate location (country or
        city), how long pages take to load, and actions such as signing up, clicking &ldquo;Buy&rdquo;, completing a payment,
        booking a slot, using the predictor, downloading a free resource or tapping a WhatsApp button.
      </p>
      <ul>
        <li><strong>We never send your name, email address or phone number to these tools.</strong> Page addresses are sent without any extra codes in them.</li>
        <li>Vercel Web Analytics does not use cookies. Google Analytics may use cookies to tell visits apart; we turn off Google&apos;s advertising features and Google Signals.</li>
        <li>The information is used only in combined form (for example, &ldquo;how many people visited this page&rdquo;) to improve our website and services. It is not used to show you ads.</li>
        <li>You can block or delete cookies in your browser settings, or use a browser add-on that blocks analytics. The website will still work.</li>
      </ul>

      <h2>4. Sharing your information</h2>
      <p>
        We do not sell your personal information. We only share it with trusted service providers (for example,
        payment gateways, email delivery, website hosting and analytics, or online class platforms) who help us run our
        services, or when required by law.
      </p>

      <h2>5. Data security</h2>
      <p>
        We take reasonable steps to protect your information from unauthorised access. However, no method of
        transmission over the internet is completely secure.
      </p>

      <h2>6. Data retention</h2>
      <p>We keep your information only as long as needed for the purposes described above or as required by law.</p>

      <h2>7. Your choices</h2>
      <p>
        You can ask us to access, correct or delete your personal information, or to stop sending you promotional
        messages, by contacting us using the details below.
      </p>

      <h2>8. Children&apos;s privacy</h2>
      <p>
        Many of our students are under 18. We encourage parents or guardians to be involved when students share
        personal information with us.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>We may update this policy from time to time. The latest version will always be available on this page.</p>

      <h2>10. Contact us</h2>
      <p>
        For any privacy questions, email <a href={`mailto:${site.email}`}>{site.email}</a>, or
        visit our <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}
