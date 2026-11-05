import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ContactForm from "@/components/ContactForm";
import DirectContact, { unlockMessage } from "@/components/contact/DirectContact";
import { BookIcon, CalendarIcon, LockIcon } from "@/components/Icons";
import PageHero from "@/components/PageHero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Unlock Direct Call & WhatsApp",
  description: `Get direct access to ${siteConfig.founder.name}'s number after booking a counselling session or buying any course or material.`,
  robots: { index: false },
};

// Where every "Call" / "WhatsApp" button leads visitors who haven't paid yet.
// ✏️ The message text lives in src/components/contact/DirectContact.tsx (unlockMessage)
export default function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  return (
    <>
      <PageHero eyebrow="Direct access" title="Unlock Direct Call & WhatsApp" subtitle={unlockMessage} />
      <section className="section bg-slate-50">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-5">
            <div className="card p-6 sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-400 text-brand-950"><LockIcon className="h-6 w-6" /></span>
              <h2 className="mt-4 text-xl font-extrabold text-brand-700">How to unlock {siteConfig.founder.name.split(" ")[0]} Sir&apos;s direct number</h2>
              <ol className="mt-4 space-y-3 text-slate-700">
                <li className="flex gap-3"><Num n={1} /> Book a counselling session, or buy any course, test series or study material.</li>
                <li className="flex gap-3"><Num n={2} /> Log in with the same account you paid with.</li>
                <li className="flex gap-3"><Num n={3} /> The full number with Call &amp; WhatsApp buttons appears on your dashboard, the contact page and the footer.</li>
              </ol>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link href="/book-a-slot" className="btn-accent !py-3"><CalendarIcon className="h-5 w-5" /> Book a Session</Link>
                <Link href="/courses" className="btn-light !py-3"><BookIcon className="h-5 w-5" /> Browse Courses</Link>
              </div>
            </div>
            {/* Shows the masked number — or the real one if this visitor has already paid */}
            <DirectContact />
          </div>

          <div id="enquiry" className="card scroll-mt-24 p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <Suspense fallback={<EnquiryBox />}>
              <PrefilledForm searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}

// If they came from a "Buy" or "WhatsApp" button, keep the message they were about to send
async function PrefilledForm({ searchParams }: { searchParams: PageProps<"/unlock">["searchParams"] }) {
  const sp = await searchParams;
  const msg = typeof sp.msg === "string" ? sp.msg.slice(0, 1500) : "";
  return <EnquiryBox message={msg === siteConfig.whatsappMessage ? "" : msg} buying={msg.startsWith("Hi, I want to buy")} />;
}

function EnquiryBox({ message = "", buying = false }: { message?: string; buying?: boolean }) {
  return (
    <>
      <h2 className="text-xl font-extrabold text-slate-900">{buying ? "Request this item — we'll send you a payment link" : "Just have a question? Send a free enquiry"}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {buying ? "Send your details below. Our team will call / WhatsApp you with a secure payment link." : "No payment needed. Our team will call you back."}
      </p>
      <div className="mt-6"><ContactForm source="unlock" defaultMessage={message} /></div>
    </>
  );
}

function Num({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>;
}
