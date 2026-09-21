import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { createPrompter } from "./lib/prompt";
import { checkDatabaseUrl } from "../src/lib/setup-validate";

/**
 *   npm run doctor
 *
 * Runs what the admin page and the sign-in do, against your real (Supabase) database, from this computer,
 * and says which step fails and why. Read-only apart from touching your own "last sign-in" time.
 *
 * It reads the settings file the setup command wrote (.env.production.local), so nothing is typed or pasted.
 * Secrets are never printed: any error text has them removed first.
 */

const ENV_FILE = process.argv[2] ?? ".env.production.local";
const { ask, askDatabaseUrl, close } = createPrompter();
const line = (s = "") => console.log(s);
const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);

const secrets: string[] = [];
const clean = (m: string) => secrets.reduce((acc, s) => (s ? acc.split(s).join("•••") : acc), m);
/** Some errors (a refused connection, a timeout) have no message of their own: fall back to their code, name and causes. */
function describe(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const inner = (e as { errors?: unknown[] }).errors?.map(describe).join("; ");
  const bits = [e.message, (e as { code?: string }).code, inner, (e as { cause?: unknown }).cause ? describe((e as { cause?: unknown }).cause) : ""].filter(Boolean);
  return bits.length ? [...new Set(bits)].join(" · ") : e.name;
}
const why = (e: unknown) => clean(describe(e));

let failures = 0;
let fromPrompt = false;
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t = Date.now();
  try {
    const out = await Promise.race([
      fn(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("no answer after 30 seconds")), 30_000)),
    ]);
    ok(`${name} (${Date.now() - t} ms)`);
    return out;
  } catch (e) {
    failures++;
    bad(`${name}: ${why(e)}`);
    return undefined;
  }
}

async function main() {
  line("\nKAC Academy: doctor");
  line("───────────────────");
  const env: Record<string, string> = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const l of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
      if (m) env[m[1]] = m[2];
    }
  } else {
    line(`No ${ENV_FILE} here (it's meant to be deleted after deploying). That's fine: paste just the database connection string.`);
    line("Only the database is checked this way. The website's own settings are checked live at https://<your-site>/api/health.\n");
    env.DATABASE_URL = await askDatabaseUrl("Transaction-pooler connection string, exactly as Supabase shows it (hidden): ", (v) => checkDatabaseUrl(v));
    env.SESSION_SECRET = randomBytes(32).toString("base64"); // only used to test that a cookie can be made and read
    fromPrompt = true;
  }
  Object.assign(process.env, env);
  (process.env as Record<string, string>).NODE_ENV = "production";
  secrets.push(env.DATABASE_URL, env.SESSION_SECRET, env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    secrets.push(decodeURIComponent(new URL(env.DATABASE_URL).password), new URL(env.DATABASE_URL).password);
  } catch {}

  if (!fromPrompt) line("Settings");
  if (!fromPrompt) for (const k of ["DATABASE_URL", "SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    env[k] ? ok(`${k} is set`) : (failures++, bad(`${k} is missing from ${ENV_FILE}`));
  }
  if (!fromPrompt && env.SESSION_SECRET && env.SESSION_SECRET.length < 16) (failures++, bad("SESSION_SECRET is too short (needs 16+ characters): sign-in cannot work"));
  if (!fromPrompt) line("  (Vercel must hold these exact values: Project → Settings → Environment Variables. After changing any, redeploy.)");

  line("\nDatabase");
  const { db } = await import("../src/lib/db/client");
  const conn = await step("connect and answer a question", async () => {
    const d = await db();
    await d.sql`select 1`;
    return d;
  });
  if (!conn) return finish();

  const admins = await step("admin accounts", async () => {
    const rows = await conn.sql<{ id: number; username: string; role: string; active: boolean; hashOk: boolean; lastLoginAt: Date | null }>`
      select id, email as username, role, active, (split_part(password_hash, '$', 1) = 'scrypt' and split_part(password_hash, '$', 3) <> '') as hash_ok, last_login_at from admins order by id`;
    if (!rows.length) throw new Error("there are NO admin accounts. Run: npm run admin:reset");
    for (const r of rows) console.log(`      ${r.username}  role=${r.role}  ${r.active ? "active" : "DISABLED"}  password stored ${r.hashOk ? "correctly" : "IN A BAD FORMAT"}  last sign-in ${r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : "never"}`);
    return rows;
  });

  await step("tables are up to date", async () => {
    const have = new Set((await conn.sql<{ name: string }>`select name from _kac_migrations`).map((r) => r.name));
    const missing = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().filter((f) => !have.has(f));
    if (missing.length) throw new Error(`the database is missing ${missing.join(", ")}. Run: npm run db:migrate (with the production DATABASE_URL)`);
  });

  line("\nWhat the admin page loads");
  const { loadWorld } = await import("../src/lib/data/load-world");
  const world = await step("event data (classes, students, scores…)", () => loadWorld(conn.sql));
  if (world) console.log(`      ${world.classes.length} classes, ${world.students.length} students, phase "${world.event.phase}"`);
  const { getAuditLog } = await import("../src/lib/data/admin");
  await step("latest activity list", () => getAuditLog(8));
  const { countEventActivity } = await import("../src/lib/reset");
  await step("activity counts", () => countEventActivity(conn.sql));
  await step("student page heartbeat", async () => {
    const { getLiveState } = await import("../src/lib/data/live");
    await getLiveState();
  });

  line("\nSign-in");
  await step("session cookie can be created and read back", async () => {
    const { signSession, verifySession } = await import("../src/lib/auth/session");
    const t = signSession({ t: "a", id: 1, exp: Math.floor(Date.now() / 1000) + 60 });
    if (!verifySession(t, "a")) throw new Error("a cookie signed with this SESSION_SECRET did not verify");
  });
  await step("a sign-in can be recorded", async () => {
    if (!admins?.length) throw new Error("no accounts to test with");
    await conn.sql`update admins set last_login_at = last_login_at where id = ${admins[0].id}`;
  });

  const username = (await ask("\nTo test your password too, type your admin username (or press Enter to skip): ")).trim();
  if (username) {
    const pw = await ask("Password (hidden): ");
    secrets.push(pw);
    const { verifyPassword } = await import("../src/lib/auth/password");
    await step(`password for ${username}`, async () => {
      const rows = await conn.sql<{ passwordHash: string; active: boolean }>`select password_hash, active from admins where lower(email) = lower(${username}::text)`;
      if (!rows[0]) throw new Error("no admin account has that username");
      if (!rows[0].active) throw new Error("that account is disabled");
      if (!(await verifyPassword(pw, rows[0].passwordHash))) throw new Error("that is not the stored password. Run: npm run admin:reset");
    });
  }
  close();
  await conn.end().catch(() => {});
  finish();
}

function finish() {
  line();
  if (failures === 0) {
    line("All checks passed: the database, the data and sign-in all work from here.");
    line("If the website still fails, the problem is on Vercel: check its Environment Variables match, then Deployments → latest → Runtime Logs.\n");
  } else {
    line(`${failures} problem${failures > 1 ? "s" : ""} found. Copy everything above the line and send it over (it contains no secrets).\n`);
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  bad(`crashed: ${why(e)}`);
  process.exit(1);
});
