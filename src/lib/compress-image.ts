"use client";

// Pictures are made smaller in the browser BEFORE upload: WebP, at most
// siteConfig.uploads.imageMaxWidth wide (1600 px). GIFs are left as they are
// (they may be animated). If the WebP isn't smaller, the original is kept.
import { siteConfig } from "@/config/site";

export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = siteConfig.uploads.imageMaxWidth;
    const scale = bitmap.width > max ? max / bitmap.width : 1;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") return file; // (very old browsers can't make WebP)
    if (blob.size >= file.size && scale === 1) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
