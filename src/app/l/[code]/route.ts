import { NextResponse, type NextRequest } from "next/server";
import { normaliseCode } from "@/lib/auth/codes";
import { rateLimited } from "@/lib/auth/rate-limit";
import { STUDENT_COOKIE, STUDENT_MAX_AGE, cookieOptions, signSession } from "@/lib/auth/session";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** The QR code on a student card points here: scan → signed in → home. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(`qr:${ip}`, 30, 60_000)) return NextResponse.redirect(new URL("/login?e=slow", request.url));
  const code = normaliseCode(raw);
  const rows = await sql<{ id: number; sessionVersion: number }>`select id, session_version from students where login_code = ${code}`;
  if (!rows[0]) return NextResponse.redirect(new URL("/login?e=code", request.url));
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(STUDENT_COOKIE, signSession({ t: "s", id: rows[0].id, v: rows[0].sessionVersion, exp: Math.floor(Date.now() / 1000) + STUDENT_MAX_AGE }), cookieOptions(STUDENT_MAX_AGE));
  return res;
}
