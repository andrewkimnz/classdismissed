import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { MIGRATION_FILES } from "@/lib/db/migrations-manifest";
import { signSession, verifySession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * A pass/fail check of this deployment's settings, for when something won't load.
 * Only ok/failed flags and a short error code come back: never a value, a message, a count or a name.
 * Cached for 10 s so it can't be used to hammer the database.
 */
export async function GET() {
  const checks: Record<string, "ok" | string> = {};
  const run = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch (e) {
      const code = (e as { code?: string }).code;
      checks[name] = `failed${code ? ` (${code})` : ""}`;
    }
  };
  const need = (v: string | undefined, min = 1) => {
    if (!v || v.length < min) throw new Error("missing");
  };

  await run("DATABASE_URL", () => need(process.env.DATABASE_URL));
  await run("SESSION_SECRET", () => need(process.env.SESSION_SECRET, 16));
  await run("NEXT_PUBLIC_SUPABASE_URL", () => need(process.env.NEXT_PUBLIC_SUPABASE_URL));
  await run("NEXT_PUBLIC_SUPABASE_ANON_KEY", () => need(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  await run("SUPABASE_SERVICE_ROLE_KEY", () => need(process.env.SUPABASE_SERVICE_ROLE_KEY));
  await run("staff sign-in cookie", () => {
    const token = signSession({ t: "a", id: 1, exp: Math.floor(Date.now() / 1000) + 60 });
    if (!verifySession(token, "a")) throw new Error("no roundtrip");
  });
  await run("database answers", async () => {
    await sql`select 1`;
  });
  await run("tables up to date", async () => {
    // MIGRATION_FILES is generated from the real supabase/migrations/ folder before every build (see
    // package.json's "prebuild"/"predev" and scripts/gen-migrations-manifest.ts), so this never goes
    // stale the way a hand-maintained filename twice did — the deployed bundle doesn't otherwise carry
    // the migrations folder, so this generated, imported constant is what stands in for it.
    const have = new Set((await sql<{ name: string }>`select name from _kac_migrations`).map((r) => r.name));
    if (MIGRATION_FILES.some((f) => !have.has(f))) throw new Error("behind");
  });
  await run("an admin account exists", async () => {
    const rows = await sql<{ n: number }>`select count(*)::int as n from admins where active`;
    if (!rows[0]?.n) throw new Error("none");
  });

  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "public, max-age=0, s-maxage=10" } });
}
