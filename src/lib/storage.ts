import fs from "node:fs/promises";
import path from "node:path";

/**
 * Photo storage.
 *  - Supabase configured → Supabase Storage (public bucket, service-role upload).
 *  - Otherwise → local disk (.data/uploads), served by /uploads/[...path]. Local only.
 */

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function localUploadPath(rel: string): string | null {
  const full = path.join(LOCAL_ROOT, rel);
  return full.startsWith(LOCAL_ROOT + path.sep) ? full : null; // blocks ../ traversal
}

export async function storePhoto(rel: string, bytes: Uint8Array, contentType: string): Promise<{ url: string; path: string }> {
  if (supabaseConfigured()) {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "photos";
    const { error } = await client.storage.from(bucket).upload(rel, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return { url: client.storage.from(bucket).getPublicUrl(rel).data.publicUrl, path: rel };
  }
  if (process.env.VERCEL) {
    throw new Error("Photo storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const full = localUploadPath(rel);
  if (!full) throw new Error("Invalid upload path.");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, bytes);
  return { url: `/uploads/${rel}`, path: rel };
}
