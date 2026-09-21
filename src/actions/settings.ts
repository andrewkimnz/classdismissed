"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validateBoundaries } from "@/lib/domain/grades";
import { isUniqueViolation } from "@/lib/db/sql";

const id = z.number().int().positive();

/** Replace the whole percentage → grade table (validated so every class always gets a grade). */
export async function saveBoundaries(input: { rows: { grade: string; minPercent: number }[] }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { rows } = parse(z.object({ rows: z.array(z.object({ grade: z.string().trim().min(1).max(4), minPercent: z.number().min(0).max(100) })).min(1).max(30) }), input);
    const errors = validateBoundaries(rows);
    if (errors.length) throw new UserError(errors[0]);
    const before = await ctx.sql`select grade, min_percent from grade_boundaries order by min_percent desc`;
    await ctx.sql`delete from grade_boundaries`;
    for (const r of rows) await ctx.sql`insert into grade_boundaries (grade, min_percent) values (${r.grade.trim()}, ${r.minPercent})`;
    await audit(ctx, "grades.boundaries", "Grade boundaries updated", { data: { before, after: rows } });
    return { message: "Grade boundaries saved. Every class was re-graded." };
  });
}

const tierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(30),
  description: z.string().trim().max(200),
  icon: z.string().trim().min(1).max(8),
  successDelta: z.number().min(-100).max(100),
  failureDelta: z.number().min(-100).max(100),
  failureDetention: z.boolean(),
  enabled: z.boolean(),
});
type TierInput = z.input<typeof tierSchema>;

export async function createTier(input: TierInput): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(tierSchema, input);
    await ctx.sql`insert into risk_tiers (name, description, icon, success_delta, failure_delta, failure_detention, enabled, sort_order)
      values (${v.name}, ${v.description}, ${v.icon}, ${v.successDelta}, ${v.failureDelta}, ${v.failureDetention}, ${v.enabled}, (select coalesce(max(sort_order), 0) + 1 from risk_tiers))`;
    await audit(ctx, "tier.create", `Risk tier ${v.name} created`, { data: v });
    return { message: `${v.name} added.` };
  });
}

/** Editing a tier never rewrites past attempts: they keep the numbers they were made with. */
export async function updateTier(input: TierInput & { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(tierSchema.extend({ id }), input);
    const rows = await ctx.sql`update risk_tiers set name = ${v.name}, description = ${v.description}, icon = ${v.icon},
      success_delta = ${v.successDelta}, failure_delta = ${v.failureDelta}, failure_detention = ${v.failureDetention}, enabled = ${v.enabled}
      where id = ${v.id} returning id`;
    if (!rows.length) throw new UserError("That tier no longer exists.");
    await audit(ctx, "tier.update", `Risk tier ${v.name} updated`, { entity: "tier", entityId: v.id, data: v });
    return { message: `${v.name} saved.` };
  });
}

export async function deleteTier(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const rows = await ctx.sql<{ name: string }>`delete from risk_tiers where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("Already deleted.");
    await audit(ctx, "tier.delete", `Risk tier ${rows[0].name} deleted`, { entity: "tier", entityId: v.id });
    return { message: `${rows[0].name} deleted. Past attempts keep their recorded numbers.` };
  });
}

// ── staff accounts ─────────────────────────────────────────────────────────
export async function createAdmin(input: { username: string; name: string; role: "admin" | "teacher"; password: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ username: z.string().trim().min(1, "Enter a username").max(40, "Keep it to 40 characters or fewer").regex(/^\S+$/, "A username can't contain spaces"), name: z.string().trim().min(1).max(60), role: z.enum(["admin", "teacher"]), password: z.string().min(1, "Enter a password").max(200) }), input);
    try {
      await ctx.sql`insert into admins (email, name, role, password_hash) values (${v.username}, ${v.name}, ${v.role}, ${await hashPassword(v.password)})`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new UserError("That username is already taken.");
      throw e;
    }
    await audit(ctx, "admin.create", `Created ${v.role} account for ${v.name}`);
    return { message: `${v.name} can now sign in as ${v.role === "admin" ? "an admin" : "a game master"}.` };
  });
}

export async function setAdminActive(input: { id: number; active: boolean }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id, active: z.boolean() }), input);
    if (v.id === ctx.actor.id && !v.active) throw new UserError("You can't deactivate your own account.");
    const rows = await ctx.sql<{ name: string }>`update admins set active = ${v.active} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That account no longer exists.");
    await audit(ctx, "admin.active", `${rows[0].name} ${v.active ? "reactivated" : "deactivated"}`);
    return { message: `${rows[0].name} ${v.active ? "can sign in again" : "is signed out and blocked"}.` };
  });
}

export async function setAdminRole(input: { id: number; role: "admin" | "teacher" }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id, role: z.enum(["admin", "teacher"]) }), input);
    if (v.id === ctx.actor.id && v.role !== "admin") throw new UserError("You can't demote yourself.");
    const rows = await ctx.sql<{ name: string }>`update admins set role = ${v.role} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That account no longer exists.");
    await audit(ctx, "admin.role", `${rows[0].name} is now ${v.role}`);
    return { message: `${rows[0].name} is now ${v.role === "admin" ? "an admin" : "a game master"}.` };
  });
}

export async function deleteAdmin(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    if (v.id === ctx.actor.id) throw new UserError("You can't delete your own account.");
    const [target] = await ctx.sql<{ name: string }>`select name from admins where id = ${v.id}`;
    if (!target) throw new UserError("That account no longer exists.");
    // Everything they did stays (scores, notes, the activity log keeps their name); those records just stop pointing at the account.
    await ctx.sql`delete from admins where id = ${v.id}`;
    await audit(ctx, "admin.delete", `Deleted the account for ${target.name}`);
    return { message: `${target.name}'s account was deleted. Their past work is kept.` };
  });
}

export async function changeMyPassword(input: { current: string; next: string }): Promise<ActionResult> {
  return run("checkin", async (ctx) => {
    const v = parse(z.object({ current: z.string(), next: z.string().min(1, "Enter a password").max(200) }), input);
    const [row] = await ctx.sql<{ passwordHash: string }>`select password_hash from admins where id = ${ctx.actor.id}`;
    if (!(await verifyPassword(v.current, row.passwordHash))) throw new UserError("Current password is wrong.");
    await ctx.sql`update admins set password_hash = ${await hashPassword(v.next)} where id = ${ctx.actor.id}`;
    await audit(ctx, "admin.password", "Changed own password");
    return { message: "Password changed." };
  });
}
