"use client";

// =====================================================================
//  ADMIN → BLOG → write / edit a post
//  Simple rich-text editor (TipTap): headings, bold, italic, lists, quotes,
//  links, pictures (uploaded to the public 'blog-images' bucket) and tables.
//  The text area looks exactly like the published article.
//  The server cleans the HTML again before saving (saveBlogPost).
// =====================================================================
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { saveBlogPost } from "@/app/admin/actions";
import { BLOG_CATEGORIES, CATEGORY_NAME, slugify, type BlogCategory } from "@/lib/blog-shared";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/site-url";
import { ExternalIcon } from "../Icons";
import { Label, Notice } from "./ui";

export type EditablePost = {
  id: string; title: string; slug: string; excerpt: string | null; category: BlogCategory; cover_image_url: string | null; content_html: string;
  seo_title: string | null; seo_description: string | null; status: "draft" | "published"; published_at: string | null; is_sample: boolean;
};

const MAX_IMAGE_MB = 5;
const istDay = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "");

/** Upload a picture to the public blog-images bucket → its https address. */
async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Please choose a JPG, PNG, WebP or GIF picture.");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Pictures must be smaller than ${MAX_IMAGE_MB} MB.`);
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("Supabase is not connected.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("blog-images").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? "Run supabase/blog.sql in Supabase first (it creates the picture storage)." : error.message);
  return supabase.storage.from("blog-images").getPublicUrl(path).data.publicUrl;
}

export default function BlogEditor({ post }: { post: EditablePost | null }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: post?.is_sample ? "" : post?.title ?? "",
    slug: post?.is_sample ? "" : post?.slug ?? "",
    excerpt: post?.is_sample ? "" : post?.excerpt ?? "",
    category: post?.category ?? ("preparation" as BlogCategory),
    cover_image_url: post?.cover_image_url ?? "",
    seo_title: post?.is_sample ? "" : post?.seo_title ?? "",
    seo_description: post?.is_sample ? "" : post?.seo_description ?? "",
    published_on: istDay(post?.published_at ?? null),
  });
  const [slugTouched, setSlugTouched] = useState(!!post && !post.is_sample);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const coverInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TiptapImage.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: post?.is_sample ? "" : post?.content_html ?? "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { "aria-label": "Article text", class: "min-h-[24rem] px-5 py-4 sm:px-8 sm:py-6" } },
    onUpdate: () => setDirty(true),
  });

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v, ...(k === "title" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setDirty(true);
  };

  async function pickCover(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      set("cover_image_url", await uploadImage(file));
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function save(status: "draft" | "published") {
    if (!editor) return;
    setMsg(null);
    start(async () => {
      const res = await saveBlogPost({ id: post?.is_sample ? undefined : post?.id, ...f, content_html: editor.getHTML(), status });
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      setDirty(false);
      setMsg({ kind: "success", text: res.message ?? "Saved." });
      if (res.data && res.data.id !== post?.id) router.replace(`/admin/blog/edit?id=${res.data.id}`);
      else router.refresh();
    });
  }

  const isPublished = post?.status === "published" && !post.is_sample;
  const seoTitle = f.seo_title || f.title || "Post title";
  const seoDesc = f.seo_description || f.excerpt || "The short description shown under the title in Google.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500"><Link href="/admin/blog" className="hover:underline">Blog</Link> / {post && !post.is_sample ? "Edit post" : "New post"}</p>
          <h1 className="text-2xl font-extrabold text-slate-900">{f.title || "Untitled post"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublished && <a href={`/blog/${post!.slug}`} target="_blank" rel="noopener noreferrer" className="btn-light">View <ExternalIcon /></a>}
          <button type="button" onClick={() => save("draft")} disabled={pending || uploading} className="btn-light disabled:opacity-60">{isPublished ? "Unpublish (draft)" : "Save draft"}</button>
          <button type="button" onClick={() => save("published")} disabled={pending || uploading} className="btn-primary disabled:opacity-60">{pending ? "Saving…" : isPublished ? "Update" : "Publish"}</button>
        </div>
      </div>
      {post?.is_sample && <Notice kind="error">This is the SAMPLE post. Saving here creates a NEW real post (the sample stays until you delete it in the list).</Notice>}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {dirty && <p className="text-xs font-semibold text-amber-700">Unsaved changes</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* ---------- Writing ---------- */}
        <div className="space-y-4">
          <input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={160} placeholder="Post title" aria-label="Post title" className="w-full rounded-2xl border-0 bg-white px-5 py-4 text-2xl font-extrabold text-brand-700 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-400 sm:text-3xl" />
          <div className="card overflow-hidden">
            <Toolbar editor={editor} onError={(t) => setMsg({ kind: "error", text: t })} />
            <div className="article max-w-none"><EditorContent editor={editor} /></div>
          </div>
          <p className="text-xs text-slate-500">Tip: use Heading 2 for main sections — they appear in the table of contents. Pictures: JPG/PNG/WebP up to {MAX_IMAGE_MB} MB.</p>
        </div>

        {/* ---------- Settings ---------- */}
        <aside className="space-y-4">
          <div className="card space-y-4 p-5">
            <div>
              <Label htmlFor="b-cat">Category</Label>
              <select id="b-cat" value={f.category} onChange={(e) => set("category", e.target.value as BlogCategory)} className="input">
                {BLOG_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_NAME[c]}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="b-slug">Web address</Label>
              <div className="flex items-center rounded-[0.8rem] ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-400">
                <span className="pl-3 text-xs text-slate-400">/blog/</span>
                <input id="b-slug" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} className="w-full border-0 bg-transparent px-1 py-2.5 text-sm focus:ring-0" placeholder="my-post-title" />
              </div>
            </div>
            <div>
              <Label htmlFor="b-excerpt">Short summary (shown on the blog list)</Label>
              <textarea id="b-excerpt" rows={3} maxLength={300} value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} className="input" />
            </div>
            <div>
              <Label htmlFor="b-date">Publish date (empty = today; future = scheduled)</Label>
              <input id="b-date" type="date" value={f.published_on} onChange={(e) => set("published_on", e.target.value)} className="input" />
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <p className="text-sm font-bold text-slate-900">Cover picture</p>
            {f.cover_image_url ? (
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-slate-100">
                <Image src={f.cover_image_url} alt="Cover" fill sizes="22rem" className="object-cover" />
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 ring-1 ring-slate-200">No cover yet. 1200×675 px (16:9) looks best — it is also used when the post is shared on WhatsApp.</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => coverInput.current?.click()} disabled={uploading} className="btn-light flex-1 !py-2 text-sm disabled:opacity-60">{uploading ? "Uploading…" : f.cover_image_url ? "Change" : "Upload picture"}</button>
              {f.cover_image_url && <button type="button" onClick={() => set("cover_image_url", "")} className="btn-light !py-2 text-sm !text-red-600">Remove</button>}
            </div>
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void pickCover(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <div className="card space-y-4 p-5">
            <p className="text-sm font-bold text-slate-900">Google (SEO)</p>
            <div>
              <Label htmlFor="b-seo-t">SEO title <span className="font-normal text-slate-400">({f.seo_title.length}/70 · empty = post title)</span></Label>
              <input id="b-seo-t" value={f.seo_title} maxLength={70} onChange={(e) => set("seo_title", e.target.value)} className="input" />
            </div>
            <div>
              <Label htmlFor="b-seo-d">SEO description <span className="font-normal text-slate-400">({f.seo_description.length}/170 · empty = summary)</span></Label>
              <textarea id="b-seo-d" rows={3} maxLength={170} value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} className="input" />
            </div>
            {/* Google result preview */}
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="truncate text-xs text-slate-500">{SITE_URL.replace(/^https?:\/\//, "")} › blog › {f.slug || "…"}</p>
              <p className="mt-0.5 line-clamp-1 text-base font-medium text-[#1a0dab]">{seoTitle}</p>
              <p className="line-clamp-2 text-xs text-slate-600">{seoDesc}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toolbar
function Toolbar({ editor, onError }: { editor: Editor | null; onError: (t: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!editor) return <div className="h-12 border-b border-slate-100 bg-slate-50" />;
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");

  function link() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = prompt("Link address (https://…). Leave empty to remove the link.", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") return void c().extendMarkRange("link").unsetLink().run();
    if (!/^(https:\/\/|mailto:|tel:|\/)/.test(url.trim())) return onError("Links must start with https://");
    c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }
  async function image(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const src = await uploadImage(file);
      const alt = prompt("Describe the picture in a few words (helps Google and screen readers):", "") ?? "";
      c().setImage({ src, alt }).run();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/95 px-2 py-1.5 backdrop-blur" role="toolbar" aria-label="Formatting">
      <B title="Heading 2" label="H2" on={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <B title="Heading 3" label="H3" on={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <B title="Normal text" label="¶" on={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()} />
      <Sep />
      <B title="Bold" label={<b>B</b>} on={editor.isActive("bold")} onClick={() => c().toggleBold().run()} />
      <B title="Italic" label={<i>I</i>} on={editor.isActive("italic")} onClick={() => c().toggleItalic().run()} />
      <B title="Underline" label={<u>U</u>} on={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()} />
      <Sep />
      <B title="Bullet list" label="•≡" on={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()} />
      <B title="Numbered list" label="1≡" on={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()} />
      <B title="Quote / tip box" label="❝" on={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()} />
      <Sep />
      <B title="Link" label="🔗" on={editor.isActive("link")} onClick={link} />
      <B title="Insert picture" label={busy ? "…" : "🖼"} disabled={busy} onClick={() => fileInput.current?.click()} />
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void image(e.target.files?.[0]); e.target.value = ""; }} />
      <Sep />
      <B title="Insert table (3×3)" label="▦" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      {inTable && (
        <>
          <B title="Add row below" label="+Row" onClick={() => c().addRowAfter().run()} />
          <B title="Add column right" label="+Col" onClick={() => c().addColumnAfter().run()} />
          <B title="Delete row" label="−Row" onClick={() => c().deleteRow().run()} />
          <B title="Delete column" label="−Col" onClick={() => c().deleteColumn().run()} />
          <B title="Delete table" label="✕▦" onClick={() => c().deleteTable().run()} />
        </>
      )}
      <Sep />
      <B title="Undo" label="↶" disabled={!editor.can().undo()} onClick={() => c().undo().run()} />
      <B title="Redo" label="↷" disabled={!editor.can().redo()} onClick={() => c().redo().run()} />
    </div>
  );
}

function B({ on, label, title, onClick, disabled }: { on?: boolean; label: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold transition disabled:opacity-30 ${on ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-200"}`}>
      {label}
    </button>
  );
}
function Sep() {
  return <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />;
}
