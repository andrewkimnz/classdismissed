import { NextResponse } from "next/server";
import { getLiveState } from "@/lib/data/live";

export const dynamic = "force-dynamic";

/**
 * Polled by every open phone (~every 5 s) as a reliable fallback to Realtime.
 * The response is identical for everyone and contains no private data, so the
 * CDN can collapse ~50 phones into one database read every couple of seconds.
 */
export async function GET() {
  try {
    const state = await getLiveState();
    return NextResponse.json(state, { headers: { "Cache-Control": "public, max-age=0, s-maxage=2, stale-while-revalidate=4" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
