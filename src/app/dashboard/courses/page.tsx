import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DashSkeleton, EmptyBox, PageHeader, Panel } from "@/components/dashboard/ui";
import FreeBadge from "@/components/FreeBadge";
import FreeDownloadButton from "@/components/free/FreeDownloadButton";
import { BookIcon, CheckIcon, ClipboardIcon, DownloadIcon, ExternalIcon, FileIcon, LockIcon, RocketIcon } from "@/components/Icons";
import { getMyPurchases, getProductContent, paidOnly, requireUser, type PurchaseRow } from "@/lib/dashboard";
import { getProducts } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { getFreeResources, suggestFor, type Suggestion } from "@/lib/free-resources";
import { formatBytes } from "@/lib/product-files";

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
  // ONLY purchases with status 'paid' are shown here
  const paid = paidOnly(await getMyPurchases(s));
  const byCat = (c: string) => paid.filter((p) => p.products!.category === c);
  const courses = byCat("crash_course");
  const files = [...byCat("study_material"), ...byCat("previous_paper")];
  const tests = byCat("mock_test");

  // Private class links come from a Supabase function that checks payment again
  const links = await Promise.all(courses.map((c) => getProductContent(s, c.products!.id)));

  // Files (PDF / ZIP) of the products they bought — Row Level Security only
  // returns files of PAID (or free) products, in the admin's order
  const ids = paid.map((p) => p.products!.id);
  const { data: fileRows } = ids.length
    ? await s.supabase.from("product_files").select("id,product_id,display_name,file_type,size_bytes,sort_order").in("product_id", ids).order("sort_order").order("created_at")
    : { data: [] };
  const filesOf = new Map<string, StudentFile[]>();
  for (const f of (fileRows ?? []) as StudentFile[]) filesOf.set(f.product_id, [...(filesOf.get(f.product_id) ?? []), f]);

  // Free tests anyone logged in can take, and paid items to suggest after a free download
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
            <Panel title="Crash courses">
              <ul className="space-y-4">
                {courses.map((c, i) => (
                  <li key={c.id} id={`item-${c.products!.id}`} className={`scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ${c.products!.id === unlockedId ? "ring-2 ring-emerald-400" : "ring-slate-200"}`}>
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
                    <FileList files={filesOf.get(c.products!.id)} itemTitle={c.products!.title} suggestion={suggestionFor(c)} />
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
                  <li key={f.id} id={`item-${f.products!.id}`} className={`scroll-mt-24 py-4 first:pt-0 last:pb-0 ${f.products!.id === unlockedId ? "-mx-2 rounded-2xl px-2 ring-2 ring-emerald-400" : ""}`}>
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

          {tests.length > 0 && (
            <Panel title="Test packs" action={<Link href="/dashboard/tests" className="text-sm font-semibold text-brand-700 hover:underline">All my tests →</Link>}>
              <ul className="space-y-3">
                {tests.map((t) => (
                  <li key={t.id} id={`item-${t.products!.id}`} className={`scroll-mt-24 rounded-2xl bg-slate-50 p-4 ring-1 ${t.products!.id === unlockedId ? "ring-2 ring-emerald-400" : "ring-slate-200"}`}>
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

type StudentFile = { id: string; product_id: string; display_name: string; file_type: "pdf" | "zip"; size_bytes: number; sort_order: number };

// Each file: PDF/ZIP icon, name, size, View (PDF) + Download.
// The buttons go to /api/files/<id>, which checks the payment on the server
// and then opens a private link that expires after 60 seconds.
// Free items: the Download button also shows a small "next step" suggestion popup.
function FileList({ files, empty, itemTitle = "", suggestion }: { files?: StudentFile[]; empty?: string; itemTitle?: string; suggestion?: Suggestion }) {
  if (!files?.length) return empty ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : null;
  return (
    <ul className="mt-3 space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white ${f.file_type === "pdf" ? "bg-red-500" : "bg-amber-500"}`}>
            {f.file_type.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{f.display_name}</p>
            <p className="text-xs text-slate-500">{f.file_type.toUpperCase()} · {formatBytes(Number(f.size_bytes))}</p>
          </div>
          <div className="flex gap-2">
            {f.file_type === "pdf" && (
              <a href={`/api/files/${f.id}?view=1`} target="_blank" rel="noopener noreferrer" className="btn-light !px-3 !py-2 text-sm">View</a>
            )}
            {suggestion ? (
              <FreeDownloadButton href={`/api/files/${f.id}`} itemTitle={itemTitle || f.display_name} suggestion={suggestion} />
            ) : (
              <a href={`/api/files/${f.id}`} className="btn-primary !px-3 !py-2 text-sm"><DownloadIcon /> Download</a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
