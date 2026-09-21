import fs from "node:fs";
import path from "node:path";
import type { Db } from "./client";

/**
 * Applies supabase/migrations/*.sql in order, exactly once each.
 * Tracks progress in `_kac_migrations` (separate from the Supabase CLI's own
 * table, so either workflow can be used).
 */
export async function migrate(conn: Db, log: (msg: string) => void = () => {}): Promise<number> {
  await conn.exec(`create table if not exists _kac_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await conn.sql<{ name: string }>`select name from _kac_migrations`).map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    log(`applying ${file}`);
    // A multi-statement simple query is a single implicit transaction in
    // Postgres, so a failing file leaves nothing half-applied.
    await conn.exec(text);
    await conn.sql`insert into _kac_migrations (name) values (${file})`;
    applied++;
  }
  return applied;
}
