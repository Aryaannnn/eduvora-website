import Link from "next/link";
import { emailLink, siteConfig, whatsappLink } from "@/config/site";
import { legalLinks } from "@/lib/navigation";
import DirectContact from "./contact/DirectContact";
import { getOpenContact } from "@/lib/contact";
import { getContactMode } from "@/lib/contact-mode";
import { InstagramIcon, MailIcon, MapPinIcon, WhatsAppIcon, YouTubeIcon } from "./Icons";
import Logo from "./Logo";

const explore = [
  { href: "/free-resources", label: "Free Resources" },
  { href: "/important-dates", label: "Important Dates" },
  { href: "/vit-counselling-guide", label: "VIT Counselling Guide" },
  ...(siteConfig.showBlog ? [{ href: "/blog", label: "Blog" }] : []),
  { href: "/courses", label: "Crash Courses" },
  { href: "/predictor", label: "Rank & College Predictor" },
  ...(siteConfig.showStudyMaterial ? [{ href: "/study-material", label: "Study Material" }] : []),
  { href: "/mock-tests", label: "Mock & MCQ Tests" },
  { href: "/previous-year-papers", label: "Previous Year Papers" },
  { href: "/question-bank", label: "Question Bank" },
  { href: "/book-a-slot", label: "Book a Slot" },
];
const company = [
  { href: "/about", label: "About Us" },
  { href: "/founder", label: "Founder Story" },
  { href: "/parents", label: "For Parents" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
  ...legalLinks,
];

export default async function Footer() {
  // Contact mode (Admin → Settings): Open = number + WhatsApp for everyone · Private = enquiry form
  const [cm, open] = await Promise.all([getContactMode(), getOpenContact()]);
  const socials = [
    { href: siteConfig.instagram, label: "Instagram", icon: InstagramIcon, newTab: true },
    { href: siteConfig.youtube, label: "YouTube", icon: YouTubeIcon, newTab: true },
    // WhatsApp (Open mode only)
    ...(open ? [{ href: whatsappLink(siteConfig.whatsappMessage, open.waDigits), label: "WhatsApp", icon: WhatsAppIcon, newTab: true }] : []),
  ];

  return (
    <footer className="border-t-4 border-accent-400 bg-brand-700 pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-300 md:pb-0 print:hidden">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div className="col-span-2 sm:col-span-1">
          {/* The logo has navy text, so it sits on a white card */}
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg"><Logo size="lg" /></div>
          <p className="mt-4 text-base font-bold text-accent-300">{siteConfig.tagline}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{siteConfig.nameMeaning}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{siteConfig.description}</p>
          <div className="mt-5 flex gap-3">
            {socials.map((s) => (
              <a key={s.label} href={s.href} target={s.newTab ? "_blank" : undefined} rel="noopener noreferrer" aria-label={s.label} className="grid h-11 w-11 place-items-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-accent-400 hover:text-brand-950">
                <s.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <FooterList title="Explore" links={explore} />
        <FooterList title="Company" links={company} />

        <div className="col-span-2 sm:col-span-1">
          <p className="text-sm font-bold uppercase tracking-wider text-white">Get in touch</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{cm.mode === "open" ? cm.openNote : "Send us a free enquiry or email us anytime."}</p>
          <ul className="mt-3 space-y-1 text-[15px] sm:mt-4 sm:space-y-3 sm:text-sm">
            {/* Open: number + Call + WhatsApp · Private: the enquiry link (decided on the server) */}
            <li><DirectContact variant="footer" /></li>
            <li><a href={emailLink} className="flex min-h-11 items-center gap-2.5 hover:text-white sm:min-h-0 sm:items-start break-all"><MailIcon className="h-4 w-4 shrink-0 sm:mt-0.5" />{siteConfig.email}</a></li>
            {siteConfig.showAddress && <li className="flex gap-2.5"><MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" />{siteConfig.address}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page space-y-2 py-6 text-xs text-slate-300">
          <p>© {siteConfig.businessName}. All rights reserved.</p>
          {/* ✏️ Text: src/config/site.ts → disclaimer */}
          <p className="max-w-4xl leading-relaxed">{siteConfig.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-white">{title}</p>
      <ul className="mt-3 text-[15px] sm:mt-4 sm:space-y-2.5 sm:text-sm">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="flex min-h-11 items-center py-1.5 leading-snug transition hover:text-white sm:inline sm:min-h-0 sm:py-0">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
