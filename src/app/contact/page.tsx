import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { pageMeta, breadcrumbLd } from "@/lib/seo";
import ContactSection from "@/components/home/ContactSection";
import PageHero from "@/components/PageHero";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon, ShieldIcon } from "@/components/Icons";
import { emailLink, siteConfig } from "@/config/site";
import { getOpenContact } from "@/lib/contact";
import { getContactMode } from "@/lib/contact-mode";

export const metadata: Metadata = pageMeta({ title: "Contact Us – VITEEE Counselling Help", description: "Contact EDUVORA for VITEEE counselling, VIT counselling guidance, courses and study material — send us an enquiry or email us anytime.", path: "/contact" });

export default async function ContactPage() {
  const [cm, open] = await Promise.all([getContactMode(), getOpenContact()]);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Contact", path: "/contact" }])} />
      <PageHero eyebrow="Contact" title="Talk to us" subtitle={cm.mode === "open" ? cm.openNote : `Send us a free enquiry or email us — ${cm.privateNote.charAt(0).toLowerCase()}${cm.privateNote.slice(1)}`} />

      {/* Business details (name, email, phone, hours, address) — all in one place */}
      <section className="container-page relative z-10 -mt-6 sm:-mt-10" aria-labelledby="business-details">
        <div className="card mx-auto max-w-4xl p-5 sm:p-6">
          <h2 id="business-details" className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ShieldIcon className="h-5 w-5 text-brand-600" /> Business details</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Business name</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{siteConfig.billingName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-0.5"><a href={emailLink} className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><MailIcon className="h-4 w-4" /> {siteConfig.email}</a></dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone / WhatsApp</dt>
              <dd className="mt-0.5">
                {open ? (
                  <a href={`tel:${open.tel}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"><PhoneIcon className="h-4 w-4" /> {open.display}</a>
                ) : (
                  <span className="text-slate-700">For enrolled students — others, please <Link href="#enquiry" className="font-semibold text-brand-700 underline">send a free enquiry</Link> and we&apos;ll call you back.</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Business hours</dt>
              <dd className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-slate-900"><ClockIcon className="h-4 w-4" /> {siteConfig.officeHours} (India time)</dd>
            </div>
            {siteConfig.showAddress && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Address</dt>
                <dd className="mt-0.5 inline-flex items-start gap-1.5 font-semibold text-slate-900"><MapPinIcon className="mt-0.5 h-4 w-4" /> {siteConfig.address}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            We provide digital services (counselling, study material, tests, live batches). See our{" "}
            <Link href="/shipping-policy" className="underline">Shipping &amp; Delivery</Link> and <Link href="/refund-policy" className="underline">Refund</Link> policies.
          </p>
        </div>
      </section>

      <ContactSection showHeading={false} />
    </>
  );
}
