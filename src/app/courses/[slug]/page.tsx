import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Accordion from "@/components/Accordion";
import BackButton from "@/components/BackButton";
import CourseCard from "@/components/cards/CourseCard";
import { CalendarIcon, CheckIcon, ClockIcon, HomeIcon, LockIcon, MonitorIcon, PhoneIcon } from "@/components/Icons";
import Reveal from "@/components/Reveal";
import BuyButton from "@/components/BuyButton";
import RefundNote from "@/components/RefundNote";
import { phoneLink } from "@/config/site";
import { getProductBySlug, getProducts } from "@/lib/data";
import { discountPercent, formatPrice } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await getProductBySlug(slug);
  return course ? { title: course.title, description: course.details.short ?? course.description ?? undefined } : { title: "Course not found" };
}

// The course comes from Supabase. The page loads per visit (inside Suspense).
export default function CourseDetailPage(props: PageProps<"/courses/[slug]">) {
  return (
    <Suspense fallback={<div className="hero-bg h-72" aria-busy="true" />}>
      <CourseDetail params={props.params} />
    </Suspense>
  );
}

async function CourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getProductBySlug(slug);
  if (!course || course.category !== "crash_course") notFound();

  const d = course.details;
  const off = discountPercent(course.price, course.original_price);
  const others = (await getProducts("crash_course")).filter((c) => c.id !== course.id).slice(0, 3);
  const facts = [
    d.duration && { icon: ClockIcon, label: "Duration", value: d.duration },
    d.mode && { icon: MonitorIcon, label: "Mode", value: d.mode },
    d.start_date && { icon: CalendarIcon, label: "Starts", value: d.start_date },
  ].filter(Boolean) as { icon: typeof ClockIcon; label: string; value: string }[];

  return (
    <>
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
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_23rem]">
        <aside className="lg:order-2">
          <div className="card p-6 shadow-xl shadow-slate-200/70 lg:sticky lg:top-24">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{formatPrice(course.price)}</span>
              {course.original_price && <span className="text-slate-400 line-through">{formatPrice(course.original_price)}</span>}
              {off > 0 && <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{off}% off</span>}
            </div>
            {facts.length > 0 && (
              <ul className="mt-5 space-y-3 border-y border-slate-100 py-5">
                {facts.map((f) => (
                  <li key={f.label} className="flex items-center gap-3 text-sm">
                    <f.icon className="h-5 w-5 text-brand-600" />
                    <span className="text-slate-500">{f.label}:</span>
                    <span className="font-semibold text-slate-900">{f.value}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5">
              <BuyButton productId={course.id} label={course.price > 0 ? "Enroll Now" : "Enroll Free"} className="btn-primary w-full !py-3.5 text-base" trust={false} />
            </div>
            <a href={phoneLink} className="btn-light mt-3 w-full">
              <PhoneIcon className="h-4 w-4" /> Call Us
            </a>
            {course.price > 0 && (
              <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-center ring-1 ring-emerald-200">
                <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-800">
                  <LockIcon className="h-4 w-4" /> 100% Secure Payments by Razorpay
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">UPI · Cards · Net banking · Wallets</p>
              </div>
            )}
            {course.price > 0 && (
              <RefundNote kind="digital" className="mt-3" />
            )}
          </div>
        </aside>

        <div className="space-y-12 lg:order-1">
          {course.description && (
            <Reveal>
              <h2 className="text-2xl font-extrabold text-slate-900">About this course</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{course.description}</p>
            </Reveal>
          )}
          {d.features && (
            <Reveal>
              <h2 className="text-2xl font-extrabold text-slate-900">Key features</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.features.map((h) => (
                  <li key={h} className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-slate-800">
                    <CheckIcon className="h-5 w-5 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          {d.syllabus && (
            <Reveal>
              <h2 className="text-2xl font-extrabold text-slate-900">What you will study</h2>
              <div className="mt-4 space-y-3">
                {d.syllabus.map((s) => (
                  <div key={s.title} className="rounded-2xl border border-slate-200 p-5">
                    <p className="font-bold text-slate-900">{s.title}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {s.topics.map((t) => <li key={t} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{t}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
          {d.includes && (
            <Reveal>
              <h2 className="text-2xl font-extrabold text-slate-900">What&apos;s included</h2>
              <ul className="mt-4 space-y-2">
                {d.includes.map((x) => (
                  <li key={x} className="flex items-center gap-3 text-slate-700"><CheckIcon className="h-5 w-5 text-green-600" /> {x}</li>
                ))}
              </ul>
            </Reveal>
          )}
          {d.faqs && d.faqs.length > 0 && (
            <Reveal>
              <h2 className="text-2xl font-extrabold text-slate-900">Questions</h2>
              <div className="mt-4"><Accordion items={d.faqs} /></div>
            </Reveal>
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
    </>
  );
}
