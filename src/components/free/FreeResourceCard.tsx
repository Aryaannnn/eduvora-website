import Link from "next/link";
import type { FreeTest } from "@/lib/free-resources";
import type { Product, ProductCategory } from "@/lib/types";
import BuyButton from "../BuyButton";
import FreeBadge from "../FreeBadge";
import { ArrowRightIcon, BookIcon, ClipboardIcon, ClockIcon, FileIcon, RocketIcon, TargetIcon } from "../Icons";

const KIND: Record<ProductCategory | "test", { label: string; icon: typeof BookIcon; box: string }> = {
  previous_paper: { label: "Previous Year Paper", icon: FileIcon, box: "bg-amber-500" },
  study_material: { label: "PDF Guide", icon: BookIcon, box: "bg-sky-500" },
  mock_test: { label: "Mock Test", icon: ClipboardIcon, box: "bg-emerald-500" },
  crash_course: { label: "Course", icon: RocketIcon, box: "bg-brand-600" },
  counselling_package: { label: "Counselling", icon: RocketIcon, box: "bg-brand-600" },
  test: { label: "Practice Test", icon: TargetIcon, box: "bg-rose-500" },
};

/** A free product (paper, PDF guide, test pack…) — log in to unlock it. */
export function FreeProductCard({ product }: { product: Product }) {
  const k = KIND[product.category];
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl text-white ${k.box}`}><k.icon className="h-5 w-5" /></span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <FreeBadge className="!py-1" />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{k.label}</span>
        </div>
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{product.title}</h3>
      {product.description && <p className="mt-1.5 line-clamp-3 text-sm text-slate-600">{product.description}</p>}
      <div className="mt-auto pt-5">
        <BuyButton productId={product.id} label="Get it Free" className="btn-accent w-full" trust={false} free />
      </div>
    </article>
  );
}

/** A free test that isn't inside a product — opens the test (it asks to log in first). */
export function FreeTestCard({ test }: { test: FreeTest }) {
  const k = test.type === "mcq" ? KIND.test : KIND.mock_test;
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl text-white ${k.box}`}><k.icon className="h-5 w-5" /></span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <FreeBadge className="!py-1" />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{test.type === "mcq" ? "MCQ Practice" : "Mock Test"}</span>
        </div>
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{test.title}</h3>
      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <ClockIcon className="h-3.5 w-3.5" /> {test.duration_minutes} minutes{test.total_marks ? ` · ${test.total_marks} marks` : ""} · instant score
      </p>
      <div className="mt-auto pt-5">
        <Link href={`/tests/${test.id}`} className="btn-accent w-full">Start Free Test <ArrowRightIcon className="h-4 w-4" /></Link>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">Free · just log in or sign up to start</p>
      </div>
    </article>
  );
}
