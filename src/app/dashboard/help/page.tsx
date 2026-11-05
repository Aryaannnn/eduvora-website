import type { Metadata } from "next";
import { Suspense } from "react";
import RequireLogin from "@/components/auth/RequireLogin";
import Link from "next/link";
import { LogoutButton } from "@/components/dashboard/Actions";
import { PageHeader, Panel } from "@/components/dashboard/ui";
import DirectContact from "@/components/contact/DirectContact";
import { ClockIcon, InstagramIcon, MailIcon, YouTubeIcon } from "@/components/Icons";
import { emailLink, siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Help" };

// The direct number is private (CONTACT_PHONE in .env.local) — see src/lib/contact.ts
export default function HelpPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RequireLogin path="/dashboard/help" />
      </Suspense>
      <PageHeader title="Help" subtitle="Stuck somewhere? We're one tap away." />
      {/* Paid students see the full number with Call & WhatsApp buttons.
          Others see the masked number and how to unlock it. */}
      <div className="max-w-xl"><DirectContact /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Other ways to reach us">
          <ul className="space-y-3 text-sm text-slate-700">
            <li><a href={emailLink} className="flex items-center gap-2 hover:text-brand-700"><MailIcon className="h-4 w-4" /> {siteConfig.email}</a></li>
            <li className="flex items-center gap-2"><ClockIcon className="h-4 w-4" /> {siteConfig.officeHours}</li>
            <li><a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-700"><InstagramIcon className="h-4 w-4" /> {siteConfig.instagramHandle}</a></li>
            <li><a href={siteConfig.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-700"><YouTubeIcon className="h-4 w-4" /> {siteConfig.youtubeHandle}</a></li>
          </ul>
        </Panel>
        <Panel title="Quick answers">
          <ul className="space-y-2 text-sm">
            <li><Link href="/refund-policy" className="font-semibold text-brand-700 hover:underline">How do refunds and cancellations work?</Link></li>
            <li><Link href="/terms-and-conditions" className="font-semibold text-brand-700 hover:underline">Terms & Conditions</Link></li>
            <li><Link href="/privacy-policy" className="font-semibold text-brand-700 hover:underline">How we protect your data</Link></li>
            <li><Link href="/contact#enquiry" className="font-semibold text-brand-700 hover:underline">Send us an enquiry</Link></li>
          </ul>
        </Panel>
      </div>

      <div className="mt-8 lg:hidden">
        <LogoutButton className="w-full" />
      </div>
    </>
  );
}
