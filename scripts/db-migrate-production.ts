import { checkDatabaseUrl } from "../src/lib/setup-validate";
import { createPrompter } from "./lib/prompt";
import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";

/**
 *   npm run db:migrate:prod
 *
 * Applies supabase/migrations/*.sql to a real (Supabase) database, without ever putting the
 * connection string — or its password — into a command you'd type, paste, or leave in your shell
 * history. `npm run db:migrate` does the same thing if you already have DATABASE_URL set, but typing
 * a whole connection string inline puts your database password in your terminal's history; this
 * asks for it hidden instead. Never touches event data: it only adds missing tables/columns.
 */
async function main() {
  const { askDatabaseUrl, close } = createPrompter();
  const url = await askDatabaseUrl("Transaction-pooler connection string, exactly as Supabase shows it (hidden): ", checkDatabaseUrl);
  close();

  const conn = await connect({ url });
  console.log(`Connected (${conn.kind}).`);
  const n = await migrate(conn, (m) => console.log(`  ${m}`));
  console.log(n ? `Applied ${n} migration(s).` : "Already up to date.");
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
