"use client";

// Admin picture upload (blog + test questions) → public https address.
// Uses the public 'blog-images' bucket (supabase/blog.sql): anyone can view,
// only admins (2-step login) can upload — checked by Supabase storage rules.
import { getBrowserSupabase } from "./supabase/client";

const MAX_IMAGE_MB = 5;

export async function uploadPublicImage(file: File, folder: string): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Please choose a JPG, PNG, WebP or GIF picture.");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Pictures must be smaller than ${MAX_IMAGE_MB} MB.`);
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("Supabase is not connected.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("blog-images").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? "Run supabase/blog.sql in Supabase first (it creates the picture storage)." : error.message);
  return supabase.storage.from("blog-images").getPublicUrl(path).data.publicUrl;
}
