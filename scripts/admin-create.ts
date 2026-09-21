import { hashPassword } from "../src/lib/auth/password";
import { connect } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";

/**  npm run admin:create -- username "password" "Your Name" [admin|teacher]  */
async function main() {
  const [username, password, name, role = "admin"] = process.argv.slice(2);
  if (!username || !password || !name) {
    console.error('Usage: npm run admin:create -- <username> <password> "<Full Name>" [admin|teacher]');
    process.exit(1);
  }
  if (!password) throw new Error("Enter a password.");
  if (!["admin", "teacher"].includes(role)) throw new Error('Role must be "admin" or "teacher".');
  const conn = await connect();
  await migrate(conn);
  const hash = await hashPassword(password);
  const existing = await conn.sql`select id from admins where lower(email) = lower(${username}::text)`;
  if (existing.length) {
    await conn.sql`update admins set password_hash = ${hash}, name = ${name}, role = ${role}, active = true where lower(email) = lower(${username}::text)`;
    console.log(`Updated existing account ${username} (${role}).`);
  } else {
    await conn.sql`insert into admins (email, name, role, password_hash) values (${username}, ${name}, ${role}, ${hash})`;
    console.log(`Created ${role} account ${username}.`);
  }
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
