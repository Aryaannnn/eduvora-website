// The picture shown when an article link is shared on WhatsApp / Facebook / X:
// cover image (if any) + the article title + EDUVORA. 1200×630.
import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { getPostBySlug } from "@/lib/blog";
import { CATEGORY_NAME } from "@/lib/blog-shared";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${siteConfig.businessName} blog article`;

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? `${siteConfig.businessName} Blog`;
  const cover = post?.cover_image_url ?? null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(135deg, #08214a 0%, #0b2a5b 55%, #2b5a9e 100%)", fontFamily: "sans-serif" }}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: cover ? "linear-gradient(0deg, rgba(3,12,29,0.92) 0%, rgba(3,12,29,0.55) 55%, rgba(3,12,29,0.15) 100%)" : "transparent" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "60px 70px", width: "100%" }}>
          {post && (
            <div style={{ display: "flex", alignSelf: "flex-start", background: "#f2a900", color: "#030c1d", fontSize: 26, fontWeight: 800, padding: "8px 20px", borderRadius: 999 }}>
              {CATEGORY_NAME[post.category]}
            </div>
          )}
          <div style={{ marginTop: 22, color: "white", fontSize: title.length > 70 ? 54 : 64, fontWeight: 800, lineHeight: 1.12, display: "flex" }}>{title}</div>
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 18, color: "#ffcd4d", fontSize: 28, fontWeight: 700 }}>
            <span>{siteConfig.businessName}</span>
            <span style={{ color: "#cbd5e1", fontWeight: 500 }}>·  {post?.author_name ?? siteConfig.founder.name}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
