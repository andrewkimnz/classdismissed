import readline from "node:readline/promises";
import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";
import { DEMO_ADMIN, seed, type SeedProfile } from "../src/lib/db/seed";

/**
 *   npm run db:seed                      demo data (After School, scores, notes, detentions)
 *   npm run db:seed -- --profile=fresh   same roster, clean School Day (for a rehearsal)
 *   npm run db:seed -- --profile=blank   config only, no students (start of the real event)
 *   npm run db:reset                     alias of db:seed (wipes activity, keeps admin accounts)
 *   flags: --demo-admin  create admin@kac.test / classdismissed  ·  --yes  skip the confirmation
 */
async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.some((a) => a === `--${name}`);
  const profile = (args.find((a) => a.startsWith("--profile="))?.split("=")[1] ?? "demo") as SeedProfile;
  if (!["demo", "fresh", "blank"].includes(profile)) throw new Error(`Unknown profile "${profile}" (demo | fresh | blank).`);

  const remote = Boolean(process.env.DATABASE_URL);
  const conn = await connect();
  if (remote && !flag("yes")) {
    const host = process.env.DATABASE_URL!.replace(/^.*@/, "").replace(/\/.*$/, "");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`This will WIPE all event data on ${host} and load "${profile}". Type "wipe" to continue: `);
    rl.close();
    if (answer.trim() !== "wipe") {
      console.log("Cancelled.");
      await conn.end();
      return;
    }
  }
  await migrate(conn, (m) => console.log(`  ${m}`));
  const demoAdmin = flag("demo-admin") || !remote;
  const summary = await seed(conn, { profile, demoAdmin });
  console.log(`Seeded "${profile}": ${summary.classes} classes, ${summary.students} students.`);
  if (summary.demoAdmin) console.log(`Demo admin: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}  (delete this account before the real event)`);
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
