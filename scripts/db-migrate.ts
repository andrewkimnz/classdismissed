import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";

async function main() {
  const conn = await connect();
  console.log(`Connected (${conn.kind}${process.env.DATABASE_URL ? "" : ": embedded demo DB in .data/pglite"}).`);
  const n = await migrate(conn, (m) => console.log(`  ${m}`));
  console.log(n ? `Applied ${n} migration(s).` : "Already up to date.");
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
