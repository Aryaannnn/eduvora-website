import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

// The EDUVORA logo. It has a see-through background with navy text,
// so ALWAYS place it on white or very light areas.
//
// Two versions (both made from public/logo-original.png, cleaned + sharpened):
//   public/logo.png          → full logo incl. "Education + Evolve + Aura" and the tagline (large places)
//   public/logo-compact.png  → cap, book and EDUVORA only — stays crisp at small sizes (navbar, sidebars)
const variants = {
  //            file                    size on screen           real size (for a sharp download)   original px
  nav: { src: "/logo-compact.png", className: "h-12 sm:h-16", sizes: "(max-width: 640px) 92px, 122px", w: 1308, h: 684 },
  sidebar: { src: "/logo-compact.png", className: "h-14", sizes: "107px", w: 1308, h: 684 },
  lg: { src: siteConfig.logo, className: "h-20 sm:h-24", sizes: "(max-width: 640px) 121px, 146px", w: 1322, h: 872 },
};

export default function Logo({ size = "nav", eager = false, link = true }: { size?: keyof typeof variants; eager?: boolean; link?: boolean }) {
  const v = variants[size];
  const img = (
    <Image
      src={v.src}
      alt={siteConfig.logoAlt}
      width={v.w}
      height={v.h}
      quality={90} // higher than the default 75 so thin letters stay sharp (allowed in next.config.ts)
      loading={eager ? "eager" : "lazy"}
      sizes={v.sizes}
      className={`${v.className} w-auto`}
    />
  );
  if (!link) return img;
  return (
    <Link href="/" className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4" aria-label={`${siteConfig.businessName} — home`}>
      {img}
    </Link>
  );
}
