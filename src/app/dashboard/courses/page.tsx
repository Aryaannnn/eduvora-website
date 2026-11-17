import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton, EmptyBox, PageHeader, Panel } from "@/components/dashboard/ui";
import FreeBadge from "@/components/FreeBadge";
import { BookIcon, CheckIcon, ClipboardIcon, ExternalIcon, FileIcon, LockIcon, RocketIcon } from "@/components/Icons";
import { getMyPurchases, getProductContent, paidOnly, requireUser, type PurchaseRow } from "@/lib/dashboard";
import { getProducts } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { getFreeResources, suggestFor, type Suggestion } from "@/lib/free-resources";
import { formatBytes } from "@/lib/product-files";
import { siteConfig } from "@/config/site";
import PdfButtons from "@/components/files/PdfButtons";
import SubjectFiles from "@/components/files/SubjectFiles";
import SubjectTabs from "@/components/files/SubjectTabs";
import { byProduct, loadStudentFiles } from "@/lib/student-files";

export const metadata: Metadata = { title: "My Courses & Material" };

export default function CoursesPage({ searchParams }: PageProps<"/dashboard/courses">) {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <CoursesContent searchParams={searchParams} />
    </Suspense>
  );
}

const isFreeRow = (p: PurchaseRow) => !!p.products?.is_free || p.amount === 0;
const gotOn = (p: PurchaseRow) => `${isFreeRow(p) ? "Unlocked free" : "Bought"} on ${formatDateTime(p.created_at)}`;

async function CoursesContent({ searchParams }: { searchParams: PageProps<"/dashboard/courses">["searchParams"] }) {
  const s = await requireUser("/dashboard/courses");
  const sp = await searchParams;
  const unlockedId = typeof sp.unlocked === "string" ? sp.unlocked : "";
  // ?open=<product id> (Course page / payment success → "Go to My Courses"): that item highlighted
  const focusId = unlockedId || (typeof sp.open === "string" ? sp.open : "");
  // ONLY purchases with status 'paid' are shown here
  const paid = paidOnly(await getMyPurchases(s));
  const byCat = (c: string) => paid.filter((p) => p.products!.category === c);
  const courses = byCat("crash_course");
  const files = [...byCat("study_material"), ...byCat("previous_paper")];
  const tests = byCat("mock_test");
  const questionBank = byCat("question_bank");

  // Private class links come from a Supabase function that checks payment again
  const links = await Promise.all(courses.map((c) => getProductContent(s, c.products!.id)));

  // PDFs of the products they bought — Row Level Security only returns files of
  // PAID (or free) products, in the admin's order. Delivered as watermarked PDFs;
  // ZIP files can't be read in the browser, so students don't see them.
  const ids = paid.map((p) => p.products!.id);
  const filesOf = byProduct(await loadStudentFiles(s.supabase, ids));
  // Crash courses that also open the Question Bank
  const { data: qbCourses } = courses.length
    ? await s.supabase.from("products").select("id,includes_question_bank").in("id", courses.map((c) => c.products!.id))
    : { data: [] };
  const withQB = new Set(((qbCourses ?? []) as { id: string; includes_question_bank?: boolean }[]).filter((c) => c.includes_question_bank).map((c) => c.id));
  const hasQB = questionBank.length > 0 || withQB.size > 0;

  // Free tests anyone logged in can take, and paid items to suggest next to free items
  const [free, ...catalogue] = await Promise.all([
    getFreeResources(),
    getProducts("crash_course"),
    getProducts("mock_test"),
    getProducts("study_material"),
    getProducts("previous_paper"),
  ]);
  const paidCatalogue = catalogue.flat().filter((p) => !p.is_free && p.price > 0);
  const suggestionFor = (row: PurchaseRow) => (isFreeRow(row) ? suggestFor(row.products!.category as Parameters<typeof suggestFor>[0], paidCatalogue) : undefined);
  const unlocked = unlockedId ? paid.find((p) => p.products?.id === unlockedId) : undefined;

  return (
    <>
      <PageHeader title="My Courses & Material" subtitle="Everything you've bought or unlocked for free, ready to use." />
      {unlocked && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <CheckIcon className="h-5 w-5 shrink-0" /> Unlocked for free: {unlocked.products!.title}. It&apos;s ready below. 🎉
        </p>
      )}
      <p className="mb-6 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
        <LockIcon className="h-4 w-4 shrink-0 text-emerald-600" /> Items you have paid for or unlocked for free appear here. PDFs are personalised with your name for your own use — please don’t share them.
      </p>

      {free.tests.length > 0 && (
        <div className="mb-6">
          <Panel title="Free practice tests" action={<Link href="/free-resources" className="text-sm font-semibold text-brand-700 hover:underline">All free resources →</Link>}>
            <div className="flex flex-wrap gap-2">
              {free.tests.map((t) => (
                <Link key={t.id} href={`/tests/${t.id}`} className="btn-accent !px-4 !py-2 text-sm">Start: {t.title} <FreeBadge className="ml-1 !bg-white/90 !text-emerald-700" /></Link>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {paid.length === 0 ? (
        <EmptyBox text="You haven't bought or unlocked anything yet. Start with our free resources — they unlock instantly." href="/free-resources" cta="See free resources" />
      ) : (
        <div className="space-y-6">
          {courses.length > 0 && (
            <Panel title="Crash courses & Formula Book">
              <ul className="space-y-4">
                {courses.map((c, i) => (
                  <li key={c.id} id={`item-${c.products!.id}`} className={`scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ${c.products!.id === focusId ? "ring-2 ring-emerald-400" : "ring-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><RocketIcon className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">{c.products!.title} {isFreeRow(c) && <FreeBadge className="ml-1 align-middle" />}</p>
                        <p className="text-xs text-slate-500">{gotOn(c)}</p>
                      </div>
                      <Link href={`/courses/${c.products!.slug}`} className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">Course page</Link>
                    </div>
                    {links[i].length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {links[i].map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2 text-sm">
                            {l.title} <ExternalIcon />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Your class links will appear here when the batch starts.</p>
                    )}
                    {siteConfig.inWebsiteReader ? (
                      <FileList files={filesOf.get(c.products!.id)} itemTitle={c.products!.title} suggestion={suggestionFor(c)} />
                    ) : (
                      <SubjectTabs files={filesOf.get(c.products!.id) ?? []} title={c.products!.title} />
                    )}
                    {withQB.has(c.products!.id) && (
                      <Link href="/dashboard/question-bank" className="btn-accent mt-3 !px-4 !py-2 text-sm">Included: Question Bank (PCM) →</Link>
                    )}
                    <TestButtons row={c} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {files.length > 0 && (
            <Panel title="Study material & previous year papers">
              <ul className="divide-y divide-slate-100">
                {files.map((f) => (
                  <li key={f.id} id={`item-${f.products!.id}`} className={`scroll-mt-24 py-4 first:pt-0 last:pb-0 ${f.products!.id === focusId ? "-mx-2 rounded-2xl px-2 ring-2 ring-emerald-400" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white">
                        {f.products!.category === "study_material" ? <BookIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{f.products!.title} {isFreeRow(f) && <FreeBadge className="ml-1 align-middle" />}</p>
                        <p className="text-xs text-slate-500">{gotOn(f)}</p>
                      </div>
                    </div>
                    <FileList files={filesOf.get(f.products!.id)} empty="Files coming soon." itemTitle={f.products!.title} suggestion={suggestionFor(f)} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {hasQB && (
            <Panel title="Question Bank" action={<Link href="/dashboard/question-bank" className="text-sm font-semibold text-brand-700 hover:underline">Open Question Bank →</Link>}>
              {questionBank.length > 0 && (
                <ul className="mb-3 space-y-4">
                  {questionBank.map((q) => (
                    <li key={q.id} id={`item-${q.products!.id}`} className={`scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ${q.products!.id === focusId ? "ring-2 ring-emerald-400" : "ring-slate-200"}`}>
                      <p className="font-bold text-slate-900">{q.products!.title} {isFreeRow(q) && <FreeBadge className="ml-1 align-middle" />}</p>
                      <p className="text-xs text-slate-500">{gotOn(q)}</p>
                      <SubjectFiles files={filesOf.get(q.products!.id)} title={q.products!.title} empty="This opens Physics, Chemistry and Mathematics — see the full Question Bank." />
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-slate-600">
                {questionBank.length === 0 && "Included with your crash course. "}
                All your Physics, Chemistry and Mathematics questions by subject — <Link href="/dashboard/question-bank" className="font-semibold text-brand-700 underline">open the Question Bank</Link>.
              </p>
            </Panel>
          )}

          {tests.length > 0 && (
            <Panel title="Test packs" action={<Link href="/dashboard/tests" className="text-sm font-semibold text-brand-700 hover:underline">All my tests →</Link>}>
              <ul className="space-y-3">
                {tests.map((t) => (
                  <li key={t.id} id={`item-${t.products!.id}`} className={`scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ${t.products!.id === focusId ? "ring-2 ring-emerald-400" : "ring-slate-200"}`}>
                    <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900"><ClipboardIcon className="h-5 w-5 text-emerald-600" /> {t.products!.title} {isFreeRow(t) && <FreeBadge />}</p>
                    <FileList files={filesOf.get(t.products!.id)} itemTitle={t.products!.title} suggestion={suggestionFor(t)} />
                    <TestButtons row={t} empty="Tests will be added to this pack soon." />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function TestButtons({ row, empty }: { row: PurchaseRow; empty?: string }) {
  const tests = (row.products?.tests ?? []).filter((t) => t.is_active);
  if (tests.length === 0) return empty ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tests.map((t) => (
        <Link key={t.id} href={`/tests/${t.id}`} className="btn-accent !px-4 !py-2 text-sm">Start: {t.title}</Link>
      ))}
    </div>
  );
}

type StudentFile = { id: string; product_id: string; display_name: string; file_type: "pdf" | "zip"; size_bytes: number; sort_order: number; chapter?: string | null };

// Each file: "Open PDF" (new tab) + "Download" — the student's personal copy,
// watermarked on the server with their name, phone and email (/api/files/<id>).
// (siteConfig.inWebsiteReader = true → "Read" in the in-website reader instead.)
function FileList({ files, empty, itemTitle = "", suggestion }: { files?: StudentFile[]; empty?: string; itemTitle?: string; suggestion?: Suggestion }) {
  if (!files?.length) return empty ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : null;
  return (
    <>
    <ul className="mt-3 space-y-2" aria-label={itemTitle ? `Files in ${itemTitle}` : "Files"}>
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white ${f.file_type === "pdf" ? "bg-red-500" : "bg-amber-500"}`}>
            {f.file_type.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{f.display_name}</p>
            <p className="text-xs text-slate-500">{siteConfig.inWebsiteReader ? "Read online" : "PDF · watermarked with your name"} · {formatBytes(Number(f.size_bytes))}</p>
          </div>
          {siteConfig.inWebsiteReader ? (
            <Link href={`/dashboard/read/${f.id}`} className="btn-primary !px-4 !py-2 text-sm" aria-label={`Read ${f.display_name} online`}>
              <BookIcon className="h-4 w-4" /> Read
            </Link>
          ) : (
            <PdfButtons fileId={f.id} name={f.display_name} />
          )}
        </li>
      ))}
    </ul>
    {/* Free item → one related next step (paid item or counselling) */}
    {suggestion && (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-accent-400/10 px-3 py-2 text-sm text-slate-700 ring-1 ring-accent-400/40">
        <RocketIcon className="h-4 w-4 text-accent-700" />
        {suggestion.kind === "counselling" ? (
          <>Want a personal plan for your rank? <Link href={suggestion.href} className="font-bold text-brand-700 underline">Book counselling</Link></>
        ) : (
          <>Next step: <Link href={suggestion.href} className="font-bold text-brand-700 underline">{suggestion.title}</Link></>
        )}
      </p>
    )}
    </>
  );
}
