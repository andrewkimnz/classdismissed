import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/auth/password";
import { createPrompter } from "./lib/prompt";
import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";
import { seed } from "../src/lib/db/seed";
import {
  checkAdminPassword, checkDatabaseUrl, checkEmail, checkProjectUrl, checkPublicKey, checkSecretKey, mask,
} from "../src/lib/setup-validate";

/**
 *   npm run setup:production
 *
 * One command to get a real (Supabase) database ready for the event:
 *   1. asks for your connection string, project URL, two API keys and an admin login (input is hidden)
 *   2. checks every value for the easy-to-make mistakes (secret key in the public slot, wrong project, …)
 *   3. connects, builds the tables, loads the blank event setup, creates your admin account
 *   4. checks the photo bucket and that the public key can read the live counter
 *   5. writes .env.production.local: the exact settings to paste into Vercel
 *
 * Secrets stay on this machine: nothing is printed, logged or committed (the settings file is git-ignored, mode 600).
 * Safe to re-run: it never wipes event data that already exists.
 */

const ENV_FILE = ".env.production.local";
const { ask, askChecked, askDatabaseUrl, close } = createPrompter();

const line = (s = "") => console.log(s);
const ok = (s: string) => console.log(`  ✓ ${s}`);
const warn = (s: string) => console.log(`  ⚠  ${s}`);

async function main() {
  line("\nKAC Academy: production setup");
  line("────────────────────────────────");
  line("Paste each value when asked. Nothing you type or paste is shown on screen. Nothing is saved except the Vercel settings file at the end.\n");

  // 1) collect + validate ──────────────────────────────────────────────────
  // Paste the string exactly as Supabase shows it (with [YOUR-PASSWORD] in it). The password is asked for
  // separately and URL-encoded here, so there's nothing to edit by hand and symbols can't break it.
  // Paste the string exactly as Supabase shows it (with [YOUR-PASSWORD] in it). The password is asked for
  // separately and URL-encoded, so there's nothing to edit by hand and symbols can't break it.
  const dbUrl = await askDatabaseUrl("1/6  Transaction-pooler connection string, exactly as Supabase shows it (hidden): ", (v) => checkDatabaseUrl(v));
  // The project URL is checked against the connection string, so pasting values from two different projects is caught.
  const dbRef = decodeURIComponent(new URL(dbUrl).username).split(".")[1];
  const projectUrl = await askChecked("2/6  Supabase project URL (https://….supabase.co): ", (v) => {
    const p = checkProjectUrl(v);
    if (!p.ok) return p;
    if (dbRef && dbRef !== p.ref) {
      return { ok: false, error: `That URL is for project ${p.ref}, but your connection string is for project ${dbRef}. Copy both from the same Supabase project.` };
    }
    return p;
  });
  console.log(`     → ${projectUrl}`);
  const publicKey = await askChecked("3/6  Publishable key, sb_publishable_… (hidden): ", checkPublicKey, { secret: true });
  const secretKey = await askChecked("4/6  Secret key, sb_secret_… (hidden): ", (v) => checkSecretKey(v, publicKey), { secret: true });
  line();
  const adminEmail = await askChecked("5/6  Your admin email: ", checkEmail);
  console.log(`     → ${adminEmail}`);
  const adminName = (await ask("     Your name (shown in the staff room): ")) || "Admin";
  console.log(`     → ${adminName}`);
  let adminPassword = "";
  for (let i = 0; i < 5 && !adminPassword; i++) {
    const pw = await askChecked("6/6  Choose an admin password, 10+ characters (hidden): ", checkAdminPassword, { secret: true });
    if ((await ask("     Type it again to confirm (hidden): ")) === pw) adminPassword = pw;
    else console.log("  ✗ Those didn't match. Try again.\n");
  }
  if (!adminPassword) {
    console.log("Passwords never matched. Nothing was changed.");
    process.exit(1);
  }
  close();

  line("\nWorking…");
  ok(`project URL, and two keys of the right kind (${mask(publicKey)}, ${mask(secretKey)})`);

  // 2) database ────────────────────────────────────────────────────────────
  const host = new URL(dbUrl).host;
  const conn = await connect({ url: dbUrl }).catch((e) => fatal("connecting", e, [dbUrl, adminPassword]));
  try {
    const [who] = await conn.sql<{ db: string }>`select current_database() as db`;
    ok(`connected to ${host} (database "${who.db}")`);

    await migrate(conn, (m) => console.log(`  … ${m}`));
    ok("tables are up to date");

    const [counts] = await conn.sql<{ classes: number; students: number }>`
      select (select count(*)::int from classes) as classes, (select count(*)::int from students) as students`;
    if (counts.classes === 0 && counts.students === 0) {
      await seed(conn, { profile: "blank", demoAdmin: false });
      ok("loaded the blank event setup (8 classes, subjects, clubs, grades; no students yet)");
    } else {
      ok(`event data already exists (${counts.classes} classes, ${counts.students} students): left exactly as it is`);
    }

    const hash = await hashPassword(adminPassword);
    const found = await conn.sql<{ id: number }>`select id from admins where lower(email) = lower(${adminEmail}::text)`;
    if (found.length) {
      await conn.sql`update admins set password_hash = ${hash}, name = ${adminName}, role = 'admin', active = true where id = ${found[0].id}`;
      ok(`admin account ${adminEmail} already existed: password updated`);
    } else {
      await conn.sql`insert into admins (email, name, role, password_hash) values (${adminEmail}, ${adminName}, 'admin', ${hash})`;
      ok(`created admin account ${adminEmail}`);
    }
  } finally {
    await conn.end();
  }

  // 3) Supabase API checks (warnings only: the database part above is what matters) ───────
  await checkStorage(projectUrl, secretKey);
  await checkPublicRead(projectUrl, publicKey);

  // 4) the settings file for Vercel ────────────────────────────────────────
  const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const keepSecret = /^SESSION_SECRET=(.{32,})$/m.exec(existing)?.[1]; // re-running must not sign everyone out
  const sessionSecret = keepSecret ?? randomBytes(48).toString("base64");
  const file = [
    "# Paste into Vercel → Settings → Environment Variables. Delete this file afterwards.",
    `DATABASE_URL=${dbUrl}`,
    `SESSION_SECRET=${sessionSecret}`,
    `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${publicKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${secretKey}`,
    "SUPABASE_STORAGE_BUCKET=photos",
    "",
  ].join("\n");
  fs.writeFileSync(ENV_FILE, file, { mode: 0o600 });
  fs.chmodSync(ENV_FILE, 0o600);
  ok(`wrote ${ENV_FILE} (${keepSecret ? "kept your existing session secret" : "with a newly generated session secret"})`);

  line(`
────────────────────────────────
DONE. The database is ready. What's left is Vercel:

  1. Copy the settings to your clipboard:
       pbcopy < ${ENV_FILE}
  2. In Vercel: Add New → Project → import your GitHub repo.
  3. Open "Environment Variables", click into the first "Key" box and paste (Cmd+V).
     Vercel fills in all six variables for you. Then click Deploy.
  4. When it's live, come back and run:  rm ${ENV_FILE}
     (it holds your secrets; you won't need it again)
`);
}

/** Show a failure without ever printing a secret. */
function fatal(what: string, err: unknown, secrets: string[]): never {
  let msg = err instanceof Error ? err.message : String(err);
  for (const s of secrets) if (s) msg = msg.split(s).join("•••");
  console.log(`\n  ✗ Problem ${what}: ${msg}`);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) console.log("    The address couldn't be found: re-check the connection string, and that you're online.");
  if (/password authentication failed|28P01/i.test(msg)) console.log("    Supabase rejected the password: re-check it (or reset it under Project Settings → Database).");
  if (/Tenant or user not found/i.test(msg)) console.log("    That usually means the pooler address or region is wrong: copy it again from Connect → Transaction pooler.");
  console.log("\nNothing was changed. Fix the value and run the command again.");
  process.exit(1);
}

async function checkStorage(url: string, secretKey: string) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, secretKey, { auth: { persistSession: false } });
    const got = await client.storage.getBucket("photos");
    if (got.data) {
      got.data.public ? ok("photo storage: bucket “photos” exists and is public") : warn("bucket “photos” exists but is PRIVATE. Photos won't show. In Supabase → Storage, open it and switch Public on.");
      return;
    }
    const made = await client.storage.createBucket("photos", { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] });
    made.error ? warn(`couldn't create the “photos” bucket (${made.error.message}). In Supabase → Storage, create a PUBLIC bucket named photos.`) : ok("photo storage: created the public bucket “photos”");
  } catch (e) {
    warn(`couldn't check photo storage (${e instanceof Error ? e.message : "network error"}). Check the secret key and URL; you can also test by uploading a photo after deploying.`);
  }
}

async function checkPublicRead(url: string, publicKey: string) {
  try {
    const headers: Record<string, string> = { apikey: publicKey };
    if (publicKey.startsWith("eyJ")) headers.Authorization = `Bearer ${publicKey}`;
    const res = await fetch(`${url}/rest/v1/live_state?select=rev&limit=1`, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.ok) ok("live updates: the public key can read the live counter");
    else warn(`the public key couldn't read the live counter (HTTP ${res.status}). Phones will still update every 5 seconds; instant updates need Realtime turned on for the live_state table.`);
  } catch (e) {
    warn(`couldn't test live updates (${e instanceof Error ? e.message : "network error"}). Not fatal: phones fall back to checking every 5 seconds.`);
  }
}

main().catch((e) => fatal("during setup", e, []));
