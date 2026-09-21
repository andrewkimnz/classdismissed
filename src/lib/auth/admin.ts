import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import type { AdminRow } from "@/lib/types";
import { ADMIN_COOKIE, verifySession } from "./session";

export { can, homePath, ROLE_PERMS, type Perm } from "./permissions";
import { can, homePath, type Perm } from "./permissions";

export const getAdmin = cache(async (): Promise<AdminRow | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = verifySession(token, "a");
  if (!payload) return null;
  const rows = await sql<AdminRow>`
    select id, email as username, name, role, active, last_login_at, created_at from admins where id = ${payload.id} and active`;
  return rows[0] ?? null;
});

/** For admin pages: redirects to the login, or to the role's own home page if it lacks access. */
export async function requireAdminPage(perm?: Perm): Promise<AdminRow> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (perm && !can(admin, perm)) redirect(`${homePath(admin)}?denied=1`);
  return admin;
}
