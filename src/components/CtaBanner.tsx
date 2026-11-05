import Link from "next/link";
import { whatsappLink } from "@/config/site";
import Reveal from "./Reveal";

// "Not sure? Talk to us" banner used at the bottom of inner pages.
export default function CtaBanner({
  title = "Not sure what's right for you?",
  text = "Book a one-to-one counselling call and get a clear plan for your rank and budget.",
}: { title?: string; text?: string }) {
  return (
    <section className="container-page pb-16 sm:pb-24">
      <Reveal className="hero-bg relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white sm:px-12">
        <div className="grid-pattern absolute inset-0" aria-hidden />
        <div className="relative">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">{text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book-a-slot" className="btn-accent !px-6 !py-3.5">Book Your Slot</Link>
            <a href={whatsappLink()} className="btn-outline !py-3.5">Chat on WhatsApp</a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
