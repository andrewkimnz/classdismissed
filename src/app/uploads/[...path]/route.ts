import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { localUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves locally stored photos (development only: production uses Supabase Storage). */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const full = localUploadPath(parts.join("/"));
  const type = TYPES[(parts.at(-1) ?? "").split(".").pop()?.toLowerCase() ?? ""];
  if (!full || !type) return new NextResponse("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(full);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
