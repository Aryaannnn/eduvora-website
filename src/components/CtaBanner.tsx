import Link from "next/link";
import { siteConfig, whatsappLink } from "@/config/site";
import { getOpenContact } from "@/lib/contact";
import Reveal from "./Reveal";

// "Not sure? Talk to us" banner used at the bottom of inner pages.
export default async function CtaBanner({
  title = "Not sure what's right for you?",
  text = "Book a 30-minute one-to-one counselling call and get a clear plan for your rank and budget.",
}: { title?: string; text?: string }) {
  const open = await getOpenContact(); // Contact mode Open → WhatsApp button
  return (
    <section className="container-page pb-16 sm:pb-24">
      <Reveal className="hero-bg relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white sm:px-12">
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">{text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5">Book Your Slot</Link>
            {open ? (
              <a href={whatsappLink(siteConfig.whatsappMessage, open.waDigits)} target="_blank" rel="noopener noreferrer" className="btn-outline !py-3.5">WhatsApp us</a>
            ) : (
              <Link href="/contact#enquiry" className="btn-outline !py-3.5">Send us an enquiry</Link>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
