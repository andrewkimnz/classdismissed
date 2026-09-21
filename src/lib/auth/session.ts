import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal signed-cookie sessions (HMAC-SHA256). No third-party auth service is
 * needed for the night: a student cookie carries {studentId, sessionVersion},
 * an admin cookie {adminId, expiry}. The database stays the source of truth.
 */

export interface SessionPayload {
  t: "s" | "a";
  id: number;
  v?: number; // student session_version
  exp: number; // epoch seconds
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  // A guessable key is only tolerated for the local embedded demo (no DATABASE_URL, not on Vercel).
  // Anything that looks like a real deployment must set a proper secret.
  const deployed = Boolean(process.env.VERCEL || process.env.DATABASE_URL);
  if (deployed || (process.env.NODE_ENV === "production" && s)) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ chars). Generate one with: openssl rand -base64 48");
  }
  return "dev-only-secret-do-not-use-in-production";
}

const b64 = (b: Buffer) => b.toString("base64url");

export function signSession(payload: SessionPayload): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  const sig = b64(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null, type: SessionPayload["t"]): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (p.t !== type || typeof p.id !== "number" || p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export const STUDENT_COOKIE = "kac_student";
export const ADMIN_COOKIE = "kac_admin";
export const STUDENT_MAX_AGE = 60 * 60 * 24 * 30;
export const ADMIN_MAX_AGE = 60 * 60 * 24;

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}
