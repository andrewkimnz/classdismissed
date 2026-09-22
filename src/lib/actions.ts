import { revalidatePath } from "next/cache";
import { ZodError, type ZodType } from "zod";
import { tx } from "@/lib/db/client";
import type { Sql } from "@/lib/db/sql";
import { can, getAdmin, type Perm } from "@/lib/auth/admin";
import { getStudentId } from "@/lib/auth/student";
import type { AdminRow } from "@/lib/types";

/** A message safe to show an organiser as-is (validation, "already awarded", …). */
export class UserError extends Error {}

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

export interface Ctx {
  actor: AdminRow;
  /** Transaction-bound: everything in one action commits or rolls back together. */
  sql: Sql;
}

/** Validate untrusted input on the server. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.length ? `${String(issue.path[issue.path.length - 1])}: ` : "";
  throw new UserError(`${field}${issue.message}`);
}

/**
 * Wraps every organiser mutation: authenticates + authorises, runs it in a
 * transaction, converts failures into readable messages, refreshes the UI.
 */
export async function run<T = undefined>(
  perm: Perm,
  fn: (ctx: Ctx) => Promise<{ message?: string; data?: T } | void>,
): Promise<ActionResult<T>> {
  try {
    const actor = await getAdmin();
    if (!actor) return { ok: false, error: "You're signed out. Reload and sign in again." };
    if (!can(actor, perm)) return { ok: false, error: "Your role can't do that." };
    const out = await tx((sql) => fn({ actor, sql }));
    revalidatePath("/", "layout");
    return { ok: true, message: out?.message, data: out?.data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
    console.error("[action failed]", e);
    return { ok: false, error: "Something went wrong and nothing was changed. Check your connection and try again." };
  }
}

export interface StudentCtx {
  studentId: number;
  /** Transaction-bound, same as `Ctx.sql`. */
  sql: Sql;
}

/**
 * The student-session equivalent of `run`: authenticates via the student's own cookie (not an
 * admin's), everything else the same (transaction, readable errors, refresh). The only caller today
 * is the Maths toss challenge; a second one is fine, a permission system for one action is not.
 */
export async function runAsStudent<T = undefined>(
  fn: (ctx: StudentCtx) => Promise<{ message?: string; data?: T } | void>,
): Promise<ActionResult<T>> {
  try {
    const studentId = await getStudentId();
    if (studentId === null) return { ok: false, error: "You're signed out. Reload and sign in again." };
    const out = await tx((sql) => fn({ studentId, sql }));
    revalidatePath("/", "layout");
    return { ok: true, message: out?.message, data: out?.data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
    console.error("[action failed]", e);
    return { ok: false, error: "Something went wrong and nothing was changed. Check your connection and try again." };
  }
}

/** Append to the audit trail (call inside `run`, so it commits with the change). */
export async function audit(
  { actor, sql }: Ctx,
  action: string,
  summary: string,
  opts: { entity?: string; entityId?: number | null; data?: unknown } = {},
) {
  await sql`
    insert into audit_log (admin_id, admin_name, action, entity, entity_id, summary, data)
    values (${actor.id}, ${actor.name}, ${action}, ${opts.entity ?? ""}, ${opts.entityId ?? null}, ${summary},
            ${opts.data === undefined ? null : opts.data}::jsonb)`;
}
