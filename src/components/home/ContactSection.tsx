import { emailLink, siteConfig } from "@/config/site";
import ContactForm from "../ContactForm";
import DirectContact from "../contact/DirectContact";
import { ClockIcon, InstagramIcon, MailIcon, MapPinIcon, YouTubeIcon } from "../Icons";
import Reveal from "../Reveal";
import SectionHeading from "../SectionHeading";

export default function ContactSection({ showHeading = true }: { showHeading?: boolean }) {
  const items = [
    { icon: MailIcon, label: "Email", value: siteConfig.email, href: emailLink, color: "bg-sky-500" },
    { icon: InstagramIcon, label: "Instagram", value: siteConfig.instagramHandle, href: siteConfig.instagram, color: "bg-gradient-to-br from-fuchsia-500 to-orange-400" },
    { icon: YouTubeIcon, label: "YouTube", value: siteConfig.youtubeHandle, href: siteConfig.youtube, color: "bg-red-600" },
  ];

  return (
    <section className="section" id="contact">
      <div className="container-page">
        {showHeading && <SectionHeading eyebrow="Contact" title="Talk to us today" subtitle="Questions about counselling, courses or material? We're one message away." />}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <Reveal className="space-y-3">
            {/* Full number only for students who have paid (checked on the server) */}
            <DirectContact />
            {items.map((it) => (
              <a
                key={it.label}
                href={it.href}
                target={it.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="card card-hover flex items-center gap-4 p-4"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white ${it.color}`}><it.icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{it.label}</span>
                  <span className="block truncate font-bold text-slate-900">{it.value}</span>
                </span>
              </a>
            ))}
            <a
              href={`${emailLink}?subject=${encodeURIComponent("Question about VITEEE counselling")}`}
              className="btn-primary w-full !py-3"
            >
              <MailIcon className="h-4 w-4" /> Send us an email
            </a>
            <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
              {siteConfig.showAddress && <span className="flex gap-2"><MapPinIcon className="h-4 w-4 shrink-0" />{siteConfig.address}</span>}
              <span className="flex items-center gap-2"><ClockIcon className="h-4 w-4 shrink-0" />{siteConfig.officeHours}</span>
            </div>
          </Reveal>

          <Reveal delay={120} id="enquiry" className="card scroll-mt-24 p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <h3 className="text-xl font-extrabold text-slate-900">Send a free enquiry</h3>
            <p className="mt-1 text-sm text-slate-600">No payment needed — fill in your details and our team will call you back.</p>
            <div className="mt-6"><ContactForm /></div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
