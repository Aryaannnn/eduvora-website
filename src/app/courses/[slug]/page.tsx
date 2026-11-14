import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Accordion from "@/components/Accordion";
import BackButton from "@/components/BackButton";
import CourseCard from "@/components/cards/CourseCard";
import { CalendarIcon, CheckIcon, ClockIcon, FileIcon, HomeIcon, LockIcon, MonitorIcon, PhoneIcon, UsersIcon, VideoIcon, WhatsAppIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import BuyButton from "@/components/BuyButton";
import RefundNote from "@/components/RefundNote";
import { phoneLink, whatsappLink } from "@/config/site";
import { getProductBySlug, getProducts } from "@/lib/data";
import { discountPercent, formatDate, formatPrice } from "@/lib/format";
import { getSeatsLeft, seatLimitOf } from "@/lib/seats";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, courseLd, pageMeta } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await getProductBySlug(slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const raw = (course.details.short ?? course.description ?? "").trim();
  const description = (raw.length >= 70 ? raw : `${course.title}: VITEEE crash course by EDUVORA with live classes, mock tests and doubt support. ${raw}`).slice(0, 158);
  return pageMeta({ title: course.title, description, path: `/courses/${course.slug}`, ...(course.thumbnail_url ? { image: { url: course.thumbnail_url, alt: course.title } } : {}) });
}

// The course comes from Supabase. The page loads per visit (inside Suspense).
// ✏️ Every section below is edited in Admin → Products → (course) → "Course page".
export default function CourseDetailPage(props: PageProps<"/courses/[slug]">) {
  return (
    <Suspense fallback={<div className="hero-bg h-72" aria-busy="true" />}>
      <CourseDetail params={props.params} />
    </Suspense>
  );
}

/** "2027-02-01" → "Mon, 1 Feb 2027"; any other text is shown as written */
const showDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? formatDate(s.trim(), true) : s);
const has = (a?: unknown[]) => Array.isArray(a) && a.length > 0;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </Reveal>
  );
}

function Ticks({ items, tone = "brand" }: { items: string[]; tone?: "brand" | "green" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((x) => (
        <li key={x} className="flex items-start gap-3 text-slate-700">
          <CheckIcon className={`mt-0.5 h-5 w-5 shrink-0 ${tone === "green" ? "text-green-600" : "text-brand-600"}`} /> {x}
        </li>
      ))}
    </ul>
  );
}

async function CourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getProductBySlug(slug);
  if (!course || course.category !== "crash_course") notFound();

  const d = course.details;
  const off = discountPercent(course.price, course.original_price);
  const [allCourses, seatsLeft] = await Promise.all([getProducts("crash_course"), getSeatsLeft(course.id, seatLimitOf(d))]);
  const others = allCourses.filter((c) => c.id !== course.id).slice(0, 3);
  const full = seatsLeft === 0;
  const free = course.is_free || course.price <= 0;
  const priceText = free ? "Free" : formatPrice(course.price);
  const enrollLabel = free ? "Enroll Free" : "Enroll Now";
  const delivery = [
    d.delivery?.live && { icon: VideoIcon, title: "Live classes", text: d.delivery.live },
    d.delivery?.recording && { icon: MonitorIcon, title: "Recordings", text: d.delivery.recording },
    d.delivery?.pdf && { icon: FileIcon, title: "PDF notes", text: d.delivery.pdf },
  ].filter(Boolean) as { icon: typeof VideoIcon; title: string; text: string }[];
  const afterPayment = has(d.after_payment) ? d.after_payment! : d.includes ?? [];

  const fullBox = (
    <div className="rounded-xl bg-amber-50 p-3 text-center ring-1 ring-amber-200">
      <p className="text-sm font-bold text-amber-900">This batch is full</p>
      <a href={whatsappLink(`Hi, the ${course.title} batch is full. Can I join the waiting list or the next batch?`)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 underline">
        <WhatsAppIcon className="h-4 w-4" /> Join the waiting list
      </a>
    </div>
  );

  return (
    <>
      {/* Google: course details (name, price in INR) + breadcrumbs */}
      <JsonLd
        data={[
          courseLd({ name: course.title, description: (d.short ?? course.description ?? course.title).slice(0, 300), path: `/courses/${course.slug}`, price: course.price, image: course.thumbnail_url }),
          breadcrumbLd([{ name: "Crash Courses", path: "/courses" }, { name: course.title, path: `/courses/${course.slug}` }]),
        ]}
      />
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="grid-pattern absolute inset-0 opacity-40" aria-hidden />
        <div className="container-page relative animate-fade-up py-10 sm:py-14">
          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Breadcrumb">
            <BackButton tone="dark" />
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <HomeIcon className="h-4 w-4" /> Home
            </Link>
            <span className="text-slate-400" aria-hidden>›</span>
            <Link href="/courses" className="font-medium text-slate-300 hover:text-white">Courses</Link>
          </nav>
          {d.badge && <span className="mt-4 inline-block rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-slate-900">{d.badge}</span>}
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">{course.title}</h1>
          {d.short && <p className="mt-4 max-w-2xl text-slate-300 sm:text-lg">{d.short}</p>}
          {/* Start date + duration, big and clear */}
          {(d.start_date || d.duration || seatsLeft !== null) && (
            <ul className="mt-6 flex flex-wrap gap-3">
              {d.start_date && (
                <li className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/20">
                  <CalendarIcon className="h-5 w-5 text-accent-300" />
                  <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">Start date</span><span className="block font-extrabold">{showDate(d.start_date)}</span></span>
                </li>
              )}
              {d.duration && (
                <li className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/20">
                  <ClockIcon className="h-5 w-5 text-accent-300" />
                  <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">Duration</span><span className="block font-extrabold">{d.duration}</span></span>
                </li>
              )}
              {seatsLeft !== null && (
                <li className={`flex items-center gap-2.5 rounded-2xl px-4 py-2.5 ring-1 ${full ? "bg-red-500/20 ring-red-300/40" : "bg-accent-400/20 ring-accent-300/40"}`}>
                  <UsersIcon className="h-5 w-5 text-accent-300" />
                  <span className="font-extrabold">{full ? "Batch full" : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_23rem]">
        <aside className="lg:order-2" id="enroll">
          <div className="card p-6 shadow-xl shadow-slate-200/70 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{priceText}</span>
              {course.original_price && <span className="text-slate-400 line-through">{formatPrice(course.original_price)}</span>}
              {off > 0 && <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{off}% off</span>}
            </div>
            <ul className="mt-5 space-y-3 border-y border-slate-100 py-5">
              {d.start_date && <Fact icon={CalendarIcon} label="Start date" value={showDate(d.start_date)} />}
              {d.duration && <Fact icon={ClockIcon} label="Duration" value={d.duration} />}
              {d.mode && <Fact icon={MonitorIcon} label="Mode" value={d.mode} />}
              {seatsLeft !== null && <Fact icon={UsersIcon} label="Seats" value={full ? "Batch full" : `${seatsLeft} left`} strong={!full && seatsLeft <= 10} />}
            </ul>
            <div className="mt-5">
              {full ? fullBox : <BuyButton productId={course.id} label={enrollLabel} className="btn-primary w-full !py-3.5 text-base" trust={false} free={course.is_free} />}
            </div>
            {/* The refund rule for live batches, in one short line, right under the button */}
            {!free && <RefundNote kind="live" className="mt-2.5" />}
            <a href={phoneLink} className="btn-light mt-4 w-full">
              <PhoneIcon className="h-4 w-4" /> Call Us
            </a>
            {!free && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-800">
                <LockIcon className="h-3.5 w-3.5" /> 100% Secure Payments by Razorpay · UPI, cards, net banking
              </p>
            )}
          </div>
        </aside>

        <div className="space-y-12 lg:order-1">
          {course.description && (
            <Section title="About this course">
              <p className="leading-relaxed text-slate-600">{course.description}</p>
            </Section>
          )}
          {has(d.who_for) && (
            <Section title="Who this is for">
              <ul className="grid gap-3 sm:grid-cols-2">
                {d.who_for!.map((w) => (
                  <li key={w} className="flex items-start gap-3 rounded-2xl bg-accent-400/10 p-4 text-sm font-semibold text-slate-800 ring-1 ring-accent-400/30">
                    <UsersIcon className="h-5 w-5 shrink-0 text-accent-700" /> {w}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {has(d.learn) && (
            <Section title="What you will learn">
              <Ticks items={d.learn!} />
            </Section>
          )}
          {has(d.features) && (
            <Section title="Key features">
              <ul className="grid gap-3 sm:grid-cols-2">
                {d.features!.map((h) => (
                  <li key={h} className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-slate-800">
                    <CheckIcon className="h-5 w-5 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {has(d.schedule) && (
            <Section title="Schedule and timings">
              <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
                {d.schedule!.map((x) => (
                  <li key={x} className="flex items-start gap-3 px-4 py-3 text-slate-700">
                    <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /> {x}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {delivery.length > 0 && (
            <Section title="How classes are delivered">
              <ul className={`grid gap-3 ${delivery.length > 1 ? "sm:grid-cols-3" : ""}`}>
                {delivery.map((x) => (
                  <li key={x.title} className="rounded-2xl p-4 ring-1 ring-slate-200">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><x.icon className="h-5 w-5" /></span>
                    <p className="mt-3 font-bold text-slate-900">{x.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{x.text}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {has(d.syllabus) && (
            <Section title="What you will study">
              <div className="space-y-3">
                {d.syllabus!.map((s) => (
                  <div key={s.title} className="rounded-2xl border border-slate-200 p-5">
                    <p className="font-bold text-slate-900">{s.title}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {s.topics.map((t) => <li key={t} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{t}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {afterPayment.length > 0 && (
            <Section title="What you get after payment">
              <Ticks items={afterPayment} tone="green" />
            </Section>
          )}
          {has(d.faqs) && (
            <Section title="Questions about this course">
              <Accordion items={d.faqs!} />
            </Section>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <section className="bg-slate-50 py-14 sm:py-20">
          <div className="container-page">
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Other courses</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {others.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {/* PHONES: sticky "Enroll Now – ₹price" bar (replaces the usual Book a Slot bar on this page) */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden print:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          <a href={whatsappLink(`Hi, I have a question about the ${course.title}`)} target="_blank" rel="noopener noreferrer" aria-label="Ask on WhatsApp" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white">
            <WhatsAppIcon className="h-6 w-6" />
          </a>
          <div className="min-w-0 flex-1">
            {full ? (
              <a href="#enroll" className="btn-light h-12 w-full !rounded-xl !py-0">Batch full — see options</a>
            ) : (
              <BuyButton productId={course.id} label={free ? "Enroll Free" : `Enroll Now – ${priceText}`} className="btn-primary h-12 w-full !rounded-xl !py-0 text-[15px]" trust={false} free={course.is_free} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Fact({ icon: Icon, label, value, strong = false }: { icon: typeof ClockIcon; label: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <Icon className="h-5 w-5 text-brand-600" />
      <span className="text-slate-500">{label}:</span>
      <span className={`font-semibold ${strong ? "text-red-600" : "text-slate-900"}`}>{value}</span>
    </li>
  );
}
