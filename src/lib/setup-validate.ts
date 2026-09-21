/**
 * Sanity checks for the values pasted into `npm run setup:production`. Pure and browser-safe.
 * The point is to catch the mistakes that are easy to make and expensive to discover on the night:
 * a SECRET key pasted into the public slot, a connection string from the wrong Supabase project, or the
 * direct connection (which Vercel can't reach) instead of the transaction pooler.
 */

export type Check = { ok: true; value: string; warn?: string } | { ok: false; error: string };
const bad = (error: string): Check => ({ ok: false, error });

/** Decode a legacy Supabase JWT key's role ("anon" | "service_role"), or null. */
export function jwtRole(key: string): string | null {
  const part = key.split(".")[1];
  if (!part) return null;
  try {
    return (JSON.parse(Buffer.from(part, "base64url").toString()) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** Project reference from https://<ref>.supabase.co */
export function checkProjectUrl(input: string): Check & { ref?: string } {
  const v = input.trim().replace(/\/+$/, "");
  const m = /^https:\/\/([a-z0-9]{15,25})\.supabase\.co$/.exec(v);
  if (!m) return bad("That doesn't look like a project URL. It should look like https://abcdefghijklmnopqrst.supabase.co");
  return { ok: true, value: v, ref: m[1] };
}

export function checkDatabaseUrl(input: string, projectRef?: string): Check {
  const v = input.trim();
  if (/\[YOUR-PASSWORD\]|<password>|\[PASSWORD\]/i.test(v)) return bad("The password placeholder is still in there. Replace [YOUR-PASSWORD] with your real database password.");
  if (!/^postgres(ql)?:\/\//.test(v)) return bad("That should start with postgresql://  (copy it from Connect → Transaction pooler).");
  let u: URL;
  try {
    u = new URL(v);
    if (!u.hostname || (u.port && Number.isNaN(Number(u.port)))) throw new Error("bad");
  } catch {
    return bad("Couldn't read that address. If your password contains symbols like @ # / ? or %, they must be URL-encoded first (@ → %40, # → %23, / → %2F, ? → %3F).");
  }
  if (!u.password) return bad("There's no password in that address.");
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(u.hostname)) {
    return bad("That's the DIRECT connection. Vercel can't reach it. Go back to Connect and choose the TRANSACTION POOLER (port 6543).");
  }
  const userRef = decodeURIComponent(u.username).split(".")[1];
  if (projectRef && userRef && userRef !== projectRef) {
    return bad(`This connection string is for a different Supabase project (${userRef}) than the project URL you gave (${projectRef}). Check you copied both from the same project.`);
  }
  const isPooler = /pooler\.supabase\.com$/.test(u.hostname);
  if (isPooler && u.port !== "6543") return { ok: true, value: v, warn: `Port ${u.port || "5432"} is the SESSION pooler. It works, but the transaction pooler (port 6543) is the one meant for Vercel.` };
  if (!isPooler && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return { ok: true, value: v, warn: "This doesn't look like a Supabase pooler address. Fine if that's intended." };
  return { ok: true, value: v };
}

/** The key that is SAFE to expose in a browser. Reject anything that is actually the secret key. */
export function checkPublicKey(input: string): Check {
  const v = input.trim();
  if (v.startsWith("sb_secret_")) return bad("STOP: that is the SECRET key. This slot is public (it ships to every phone). Use the key that starts sb_publishable_.");
  if (v.startsWith("sb_publishable_") && v.length >= 25) return { ok: true, value: v };
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) {
    const role = jwtRole(v);
    if (role === "service_role") return bad("STOP: that is the legacy service_role (SECRET) key. This slot is public. Use the anon key or the sb_publishable_ key.");
    if (role === "anon") return { ok: true, value: v, warn: "Legacy anon key accepted (Supabase is phasing these out; the sb_publishable_ key is the current one)." };
  }
  return bad("That doesn't look like a publishable key. It should start with sb_publishable_ (Settings → API Keys).");
}

/** The key that must NEVER reach a browser. Reject anything that is actually the public key. */
export function checkSecretKey(input: string, publicKey: string): Check {
  const v = input.trim();
  if (v === publicKey.trim()) return bad("That's the same value as the public key. The secret key is a different one.");
  if (v.startsWith("sb_publishable_")) return bad("That is the PUBLISHABLE key. This slot needs the SECRET key that starts sb_secret_.");
  if (v.startsWith("sb_secret_") && v.length >= 25) return { ok: true, value: v };
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) {
    const role = jwtRole(v);
    if (role === "anon") return bad("That is the legacy anon (PUBLIC) key. This slot needs the service_role key or the sb_secret_ key.");
    if (role === "service_role") return { ok: true, value: v, warn: "Legacy service_role key accepted (Supabase is phasing these out; the sb_secret_ key is the current one)." };
  }
  return bad("That doesn't look like a secret key. It should start with sb_secret_ (Settings → API Keys).");
}

export function checkEmail(input: string): Check {
  const v = input.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { ok: true, value: v } : bad("That doesn't look like an email address.");
}

export function checkAdminPassword(pw: string): Check {
  if (pw.length < 1) return bad("Enter a password.");
  if (/^(password|1234567890|qwertyuiop)/i.test(pw)) return bad("That's too easy to guess.");
  return { ok: true, value: pw };
}

/** Never print a secret: show what kind it is and how long. */
export const mask = (s: string) => `${s.slice(0, s.startsWith("sb_") ? s.indexOf("_", 3) + 1 : 4)}… (${s.length} characters)`;
