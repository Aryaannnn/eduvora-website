import Image from "next/image";
import { founder } from "@/content/founder";
import { initials } from "@/lib/format";

// Founder photo in a rounded frame with a soft gold border.
// The photo (public/founder.jpg) is a portrait — we keep the face in view by
// focusing the crop on the upper part of the picture.
export default function FounderPhoto({ size = "md", eager = false }: { size?: "md" | "lg"; eager?: boolean }) {
  const box = size === "lg" ? "max-w-[22rem]" : "max-w-sm";
  return (
    <div className={`relative mx-auto w-full ${box}`}>
      {/* soft navy + gold glow behind the frame */}
      <div className="absolute -inset-3 rounded-[2.25rem] bg-gradient-to-br from-accent-300/50 via-transparent to-brand-500/30 blur-xl" aria-hidden />
      <div className="relative overflow-hidden rounded-[2rem] bg-white p-2 shadow-xl shadow-brand-900/15 ring-4 ring-accent-400/70">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-brand-50 to-white">
          {founder.photo ? (
            <Image
              src={founder.photo}
              alt={founder.photoAlt}
              fill
              loading={eager ? "eager" : "lazy"}
              quality={90}
              sizes="(min-width: 1024px) 384px, 90vw"
              className="object-cover object-[50%_28%]"
            />
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-brand-600 text-4xl font-extrabold text-white">{initials(founder.name)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
