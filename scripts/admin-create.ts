import { hashPassword } from "../src/lib/auth/password";
import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";

/**  npm run admin:create -- you@example.com "a-long-password" "Your Name" [admin|teacher]  */
async function main() {
  const [email, password, name, role = "admin"] = process.argv.slice(2);
  if (!email || !password || !name) {
    console.error('Usage: npm run admin:create -- <email> <password> "<Full Name>" [admin|teacher]');
    process.exit(1);
  }
  if (password.length < 10) throw new Error("Use a password of at least 10 characters.");
  if (!["admin", "teacher"].includes(role)) throw new Error('Role must be "admin" or "teacher".');
  const conn = await connect();
  await migrate(conn);
  const hash = await hashPassword(password);
  const existing = await conn.sql`select id from admins where lower(email) = lower(${email}::text)`;
  if (existing.length) {
    await conn.sql`update admins set password_hash = ${hash}, name = ${name}, role = ${role}, active = true where lower(email) = lower(${email}::text)`;
    console.log(`Updated existing account ${email} (${role}).`);
  } else {
    await conn.sql`insert into admins (email, name, role, password_hash) values (${email}, ${name}, ${role}, ${hash})`;
    console.log(`Created ${role} account ${email}.`);
  }
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
