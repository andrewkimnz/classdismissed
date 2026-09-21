import type { Db } from "./client";
import { migrate } from "./migrate";
import { seed } from "./seed";

/** Zero-config demo mode: apply migrations and load the demo data on first boot. */
export async function prepareEmbedded(conn: Db) {
  await migrate(conn, (m) => console.log(`[db] ${m}`));
  const seeded = await conn.sql`select 1 from _kac_migrations where name = 'auto-seed:demo'`;
  if (seeded.length === 0) {
    console.log("[db] first run: loading demo data into the embedded database (.data/pglite)");
    await seed(conn, { profile: "demo", demoAdmin: true });
    await conn.sql`insert into _kac_migrations (name) values ('auto-seed:demo')`;
  }
}
