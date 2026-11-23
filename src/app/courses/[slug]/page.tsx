import type { Metadata } from "next";
import { accessLabel, productAccess } from "@/lib/access";
import RatingLine from "@/components/reviews/RatingLine";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Accordion from "@/components/Accordion";
import BackButton from "@/components/BackButton";
import { CalendarIcon, CheckIcon, ClockIcon, FileIcon, HomeIcon, LockIcon, MailIcon, MonitorIcon, PhoneIcon, UsersIcon, VideoIcon, WhatsAppIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import BuyButton from "@/components/BuyButton";
import RefundNote from "@/components/RefundNote";
import { phoneLink, whatsappLink } from "@/config/site";
import { getOpenContact } from "@/lib/contact";
import { getCourses, getProductBySlug } from "@/lib/data";
import { discountPercent, formatDate, formatPrice } from "@/lib/format";
import { getSeatsLeft, seatLimitOf } from "@/lib/seats";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, courseLd, pageMeta } from "@/lib/seo";
import EnrolledBadge from "@/components/EnrolledBadge";
import { getFileSummary, getPlanSummary } from "@/lib/file-summary";
import CourseGrid from "@/components/courses/CourseGrid";
import { SUBJECT_KEYS, SUBJECT_UI } from "@/components/courses/SubjectIcon";
import { durationBadge, enrollLabel as enrollText, productNoun } from "@/lib/courses";
import { siteConfig } from "@/config/site";

export async function generateMetadata(props: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await getProductBySlug(slug);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const raw = (course.details.short ?? course.description ?? "").trim();
  const description = (raw.length >= 70 ? raw : `${course.title}: VITEEE crash course by EDUVORA with live classes, mock tests and doubt support. ${raw}`).slice(0, 158);
  return pageMeta({ title: course.title, description, path: `/courses/${course.slug}`, ...(course.thumbnail_url ? { image: { url: course.thumbnail_url, alt: course.title } } : {}) });
}

// Every current course page is built ahead of time (fast, no layout jump while it loads).
// New courses work straight away too: the first visitor gets them built on demand.
export async function generateStaticParams() {
  const courses = await getCourses();
  return courses.length ? courses.map((c) => ({ slug: c.slug })) : [{ slug: "viteee-crash-course" }];
}

// The course comes from Supabase (inside Suspense).
// ✏️ Every section below is edited in Admin → Products → (course) → "Course page".
export default function CourseDetailPage(props: PageProps<"/courses/[slug]">) {
  return (
    // (the placeholder fills the screen, so nothing visible jumps if the page ever streams in)
    <Suspense fallback={<div className="hero-bg min-h-[100svh]" aria-busy="true" />}>
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
  const open = await getOpenContact(); // Contact mode Open → WhatsApp buttons
  const { slug } = await params;
  const course = await getProductBySlug(slug);
  if (!course || course.category !== "crash_course") notFound();

  const d = course.details;
  const off = discountPercent(course.price, course.original_price);
  // files: "45 PDFs · Physics, Chemistry, Mathematics" — a summary only (no file names, no links)
  const [allCourses, seatsLeft, files, plan] = await Promise.all([getCourses(), getSeatsLeft(course.id, seatLimitOf(d)), getFileSummary(course.id), getPlanSummary(course.id)]);
  const others = allCourses.filter((c) => c.id !== course.id).slice(0, 3);
  const badge = durationBadge(course.slug, d.duration);
  const item = productNoun(course.slug); // "course" / "Formula Book" / "Question Bank"
  const special = item !== "course";
  const hasOriginal = !!course.original_price && course.original_price > course.price;
  // Admin FAQ, or a short neutral one
  const faqs = has(d.faqs)
    ? d.faqs!
    : [
        { q: "How do I get the PDFs?", a: `Right after your payment is confirmed, the ${item} appears in Dashboard → My Courses & Material. Open or download each PDF there, subject by subject.` },
        { q: "Are the PDFs personal?", a: "Yes. Every PDF is watermarked with your name, email and phone number and is for your own study only — please don't share it." },
        { q: "Can I study on my phone?", a: "Yes. Open a PDF in your browser, or download it to your phone or laptop." },
        { q: `What if I can't access the ${item}?`, a: `Contact us with your Payment ID and we'll fix it. ${siteConfig.refunds.digitalNote}` },
      ];
  const full = seatsLeft === 0;
  const free = course.is_free || course.price <= 0;
  const priceText = free ? "Free" : formatPrice(course.price);
  const enrollLabel = enrollText(free); // same text everywhere (src/lib/courses.ts)
  const delivery = [
    d.delivery?.live && { icon: VideoIcon, title: "Live classes", text: d.delivery.live },
    d.delivery?.recording && { icon: MonitorIcon, title: "Recordings", text: d.delivery.recording },
    d.delivery?.pdf && { icon: FileIcon, title: "PDF notes", text: d.delivery.pdf },
  ].filter(Boolean) as { icon: typeof VideoIcon; title: string; text: string }[];
  const afterPayment = has(d.after_payment) ? d.after_payment! : d.includes ?? [];

  const fullBox = (
    <div className="rounded-xl bg-amber-50 p-3 text-center ring-1 ring-amber-200">
      <p className="text-sm font-bold text-amber-900">This batch is full</p>
      {open ? (
        <a href={whatsappLink(`Hi, the ${course.title} batch is full. Can I join the waiting list or the next batch?`, open.waDigits)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 underline">
          <WhatsAppIcon className="h-4 w-4" /> Join the waiting list
        </a>
      ) : (
        <Link href="/contact#enquiry" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 underline">
          <MailIcon className="h-4 w-4" /> Join the waiting list
        </Link>
      )}
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
            <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <HomeIcon className="h-4 w-4" /> Home
            </Link>
            <span className="text-slate-400" aria-hidden>›</span>
            <Link href="/courses" className="font-medium text-slate-300 hover:text-white">Courses</Link>
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {badge && <span className="inline-block rounded-full bg-accent-400 px-3 py-1 text-xs font-extrabold text-brand-950">{badge}</span>}
            {d.popular && <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-800">★ Most Popular</span>}
            {d.badge && <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25">{d.badge}</span>}
            <EnrolledBadge productId={course.id} />
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">{course.title}</h1>
          {d.short && <p className="mt-4 max-w-2xl text-slate-300 sm:text-lg">{d.short}</p>}
          <div className="mt-6 hidden flex-wrap items-center gap-4 md:flex">
            <span className="text-3xl font-extrabold">{priceText}</span>
            {hasOriginal && <span className="text-slate-400 line-through">{formatPrice(course.original_price!)}</span>}
            {!full && (
              <div className="w-56">
                <BuyButton productId={course.id} label={enrollLabel} className="btn-accent w-full !py-3" trust={false} free={course.is_free} />
              </div>
            )}
          </div>
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

      {/* No PDFs on this page — students open / download them only in Dashboard → My Courses & Material */}
      <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_23rem]">
        <aside className="lg:order-2" id="enroll">
          <div className="card p-6 shadow-xl shadow-slate-200/70 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{priceText}</span>
              {hasOriginal && <span className="text-slate-500 line-through">{formatPrice(course.original_price!)}</span>}
              {off > 0 && <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{off}% off</span>}
            </div>
            <ul className="mt-5 space-y-3 border-y border-slate-100 py-5">
              {d.start_date && <Fact icon={CalendarIcon} label="Start date" value={showDate(d.start_date)} />}
              {d.duration && <Fact icon={ClockIcon} label="Duration" value={d.duration} />}
              {d.mode && <Fact icon={MonitorIcon} label="Mode" value={d.mode} />}
              <Fact icon={LockIcon} label="Access" value={accessLabel(productAccess(course.details)).replace(/^Access:\s*|^Access\s+/, "").replace(/^until/, "Until").replace(/^Lifetime access$/, "Lifetime")} />
              {files && files.pdfs > 0 && <Fact icon={FileIcon} label="Includes" value={files.text} />}
              {plan && <Fact icon={CalendarIcon} label="Study plan" value={`Day-wise (${plan.days} days)`} />}
              {seatsLeft !== null && <Fact icon={UsersIcon} label="Seats" value={full ? "Batch full" : `${seatsLeft} left`} strong={!full && seatsLeft <= 10} />}
            </ul>
            <div className="mt-5">
              {full ? fullBox : <BuyButton productId={course.id} label={enrollLabel} className="btn-primary w-full !py-3.5 text-base" trust={false} free={course.is_free} />}
            </div>
            {/* The refund rule, in one short line, right under the button */}
            {!free && <RefundNote kind="digital" className="mt-2.5" />}
            {/* "Rating: x/5 from N reviews" — only with 5+ approved reviews */}
            <RatingLine className="mt-2" />
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
          <Section title="What's included">
            <ul className="grid gap-3 sm:grid-cols-3">
              {SUBJECT_KEYS.map((k) => {
                const ui = SUBJECT_UI[k];
                const n = files?.bySubject[k] ?? 0;
                return (
                  <li key={k} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl text-white ${ui.box}`}><ui.Icon className="h-6 w-6" /></span>
                    <p className="mt-3 font-extrabold text-slate-900">{ui.label}</p>
                    <p className="text-sm text-slate-600">{n ? `${n} PDF${n === 1 ? "" : "s"}` : "PDFs being added"}</p>
                  </li>
                );
              })}
            </ul>
            {files && files.pdfs > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><FileIcon className="h-4 w-4 text-brand-600" /> {files.text}</p>
            )}
            {plan && (
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarIcon className="h-4 w-4 text-brand-600" /> Day-wise study plan included ({plan.days} days)</p>
            )}
          </Section>
          {course.description && course.description !== d.short && (
            <Section title={special ? `About the ${item}` : "About this course"}>
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
          <Section title="How you get access">
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { t: "Enroll and pay", x: "Pay securely with Razorpay — UPI, cards or net banking." },
                { t: "Open your dashboard", x: `The ${item} appears in My Courses & Material right after payment.` },
                { t: "Study by subject", x: "Open or download each PDF — watermarked with your name." },
              ].map((step, i) => (
                <li key={step.t} className="rounded-2xl bg-brand-50 p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{i + 1}</span>
                  <p className="mt-3 font-bold text-slate-900">{step.t}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.x}</p>
                </li>
              ))}
            </ol>
          </Section>
          <Section title={special ? `Questions about the ${item}` : "Questions about this course"}>
            <Accordion items={faqs} />
            {!free && <RefundNote kind="digital" className="mt-4 !text-left" />}
          </Section>
        </div>
      </div>

      {others.length > 0 && (
        <section className="bg-slate-50 py-14 sm:py-20">
          <div className="container-page">
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Other courses</h2>
            <CourseGrid courses={others} className="mt-8" />
          </div>
        </section>
      )}

      {/* PHONES: sticky "Enroll Now – ₹price" bar (replaces the usual Book a Slot bar on this page) */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden print:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          {open ? (
            <a href={whatsappLink(`Hi, I have a question about the ${course.title}`, open.waDigits)} target="_blank" rel="noopener noreferrer" aria-label="Ask on WhatsApp" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white">
              <WhatsAppIcon className="h-6 w-6" />
            </a>
          ) : (
            <Link href="/contact#enquiry" aria-label="Send us an enquiry" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <MailIcon className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            {full ? (
              <a href="#enroll" className="btn-light h-12 w-full !rounded-xl !py-0">Batch full — see options</a>
            ) : (
              <BuyButton productId={course.id} label={free ? enrollLabel : `${enrollLabel} – ${priceText}`} className="btn-primary h-12 w-full !rounded-xl !py-0 text-[15px]" trust={false} free={course.is_free} />
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
