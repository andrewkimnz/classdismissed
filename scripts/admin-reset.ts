import { hashPassword } from "../src/lib/auth/password";
import { connect } from "../src/lib/db/client";
import { checkAdminPassword, checkDatabaseUrl, checkEmail } from "../src/lib/setup-validate";
import { createPrompter } from "./lib/prompt";

/**
 *   npm run admin:reset
 *
 * Can't sign in to the staff room? This shows which admin accounts exist (emails only) and lets you set a new
 * password, or create an account, without touching any event data. Every prompt is hidden.
 */
const { ask, askChecked, askDatabaseUrl, close } = createPrompter();

async function main() {
  console.log("\nKAC Academy: reset an admin login");
  console.log("─────────────────────────────────");
  console.log("Nothing you type or paste is shown on screen. No event data is changed.\n");

  const dbUrl = await askDatabaseUrl("1/3  Transaction-pooler connection string, exactly as Supabase shows it (hidden): ", (v) => checkDatabaseUrl(v));
  const conn = await connect({ url: dbUrl }).catch((e) => {
    let msg = e instanceof Error ? e.message : String(e);
    msg = msg.split(dbUrl).join("•••");
    console.log(`\n  ✗ Couldn't connect: ${msg}`);
    if (/password authentication failed|28P01/i.test(msg)) console.log("    Supabase rejected the database password. Re-check it (Project Settings → Database → reset it if unsure).");
    console.log("\nNothing was changed.");
    process.exit(1);
  });

  try {
    const accounts = await conn.sql<{ email: string; name: string; role: string; active: boolean; lastLoginAt: Date | null }>`
      select email, name, role, active, last_login_at from admins order by id`;
    console.log("\nAccounts that exist right now:");
    if (!accounts.length) console.log("  (none)");
    for (const a of accounts) {
      console.log(`  • ${a.email}  [${a.role === "admin" ? "admin" : "game master"}${a.active ? "" : ", DEACTIVATED"}]  ${a.lastLoginAt ? "last signed in " + a.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") + " UTC" : "never signed in"}`);
    }
    console.log();

    const email = await askChecked("2/3  Email for the account to reset (or create): ", checkEmail);
    console.log(`     → ${email}`);
    const existing = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    console.log(existing ? "     That account exists: its password will be replaced." : "     No account has that email: a new admin account will be created.");

    let password = "";
    for (let i = 0; i < 5 && !password; i++) {
      const pw = await askChecked("3/3  New password, 10+ characters (hidden): ", checkAdminPassword, { secret: true });
      if ((await ask("     Type it again to confirm (hidden): ")) === pw) password = pw;
      else console.log("  ✗ Those didn't match. Try again.\n");
    }
    if (!password) {
      console.log("Passwords never matched. Nothing was changed.");
      process.exit(1);
    }
    close();

    const hash = await hashPassword(password);
    if (existing) {
      await conn.sql`update admins set password_hash = ${hash}, active = true where lower(email) = lower(${email}::text)`;
      console.log(`\n  ✓ New password set for ${email}${existing.role === "admin" ? "" : " (note: this account is a game master, so it only sees the During event tools)"}.`);
    } else {
      await conn.sql`insert into admins (email, name, role, password_hash) values (${email}, ${email.split("@")[0]}, 'admin', ${hash})`;
      console.log(`\n  ✓ Created admin account ${email}.`);
    }
    console.log("  Sign in at /admin/login with that email and the new password.\n");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.log(`\n  ✗ ${e instanceof Error ? e.message : e}\nNothing was changed.`);
  process.exit(1);
});
