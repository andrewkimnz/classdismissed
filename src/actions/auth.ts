"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { normaliseCode } from "@/lib/auth/codes";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimited } from "@/lib/auth/rate-limit";
import {
  ADMIN_COOKIE, ADMIN_MAX_AGE, STUDENT_COOKIE, STUDENT_MAX_AGE, cookieOptions, signSession,
} from "@/lib/auth/session";
import { clientIp } from "@/lib/url";
import { homePath } from "@/lib/auth/permissions";
import type { AdminRole } from "@/lib/types";

export interface FormState {
  error?: string;
}

/** Student sign-in: a short code from their ID card. No account, no password. */
export async function studentLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (rateLimited(`student:${ip}`, 20, 60_000)) return { error: "Too many tries. Wait a minute, then try again." };
  const code = normaliseCode(String(formData.get("code") ?? ""));
  if (code.length < 4) return { error: "Enter the code from your student card." };
  const rows = await sql<{ id: number; sessionVersion: number }>`
    select id, session_version from students where login_code = ${code}`;
  if (!rows[0]) return { error: "We couldn't find that code. Check the card and try again, or ask an exec at the desk." };
  (await cookies()).set(
    STUDENT_COOKIE,
    signSession({ t: "s", id: rows[0].id, v: rows[0].sessionVersion, exp: Math.floor(Date.now() / 1000) + STUDENT_MAX_AGE }),
    cookieOptions(STUDENT_MAX_AGE),
  );
  redirect("/");
}

export async function studentLogout(): Promise<void> {
  (await cookies()).delete(STUDENT_COOKIE);
  redirect("/login");
}

export async function adminLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (rateLimited(`admin:${ip}`, 10, 5 * 60_000)) return { error: "Too many attempts. Wait a few minutes." };
  const username = String(formData.get("username") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rows = await sql<{ id: number; passwordHash: string; active: boolean; role: AdminRole }>`
    select id, password_hash, active, role from admins where lower(email) = lower(${username}::text)`; // the column is still named "email"
  const row = rows[0];
  // Same message and roughly the same work for unknown usernames and wrong passwords.
  const ok = row && row.active ? await verifyPassword(password, row.passwordHash) : await verifyPassword(password, "scrypt$00$00").catch(() => false);
  if (!row || !row.active || !ok) return { error: "Wrong username or password." };
  await sql`update admins set last_login_at = now() where id = ${row.id}`;
  (await cookies()).set(
    ADMIN_COOKIE,
    signSession({ t: "a", id: row.id, exp: Math.floor(Date.now() / 1000) + ADMIN_MAX_AGE }),
    cookieOptions(ADMIN_MAX_AGE),
  );
  redirect(homePath(row));
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
