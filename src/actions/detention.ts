"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult, type Ctx } from "@/lib/actions";

const id = z.number().int().positive();

export async function assignDetention(input: { studentId: number; reason: string }): Promise<ActionResult> {
  return run("detention", async (ctx) => {
    const v = parse(z.object({ studentId: id, reason: z.string().trim().min(1, "Give a reason").max(200) }), input);
    const [student] = await ctx.sql<{ name: string }>`select name from students where id = ${v.studentId}`;
    if (!student) throw new UserError("That student no longer exists.");
    const pending = await ctx.sql`select 1 from detentions where student_id = ${v.studentId} and status = 'pending'`;
    if (pending.length) throw new UserError(`${student.name} is already in detention.`);
    await ctx.sql`insert into detentions (student_id, reason, room, created_by)
      values (${v.studentId}, ${v.reason}, (select detention_room from events where id = 1), ${ctx.actor.id})`;
    await audit(ctx, "detention.assign", `${student.name} → detention: ${v.reason}`, { entity: "student", entityId: v.studentId });
    return { message: `${student.name} sent to detention.` };
  });
}

async function setStatus(detentionId: number, status: "pending" | "served" | "cancelled", ctx: Ctx) {
  const rows = await ctx.sql<{ studentId: number; name: string }>`
    update detentions set status = ${status}, released_at = ${status === "pending" ? null : new Date()}, released_by = ${status === "pending" ? null : ctx.actor.id}
    where id = ${detentionId} returning student_id, (select name from students where id = student_id) as name`;
  if (!rows.length) throw new UserError("That detention no longer exists.");
  return rows[0];
}

export async function markDetentionServed(input: { id: number }): Promise<ActionResult> {
  return run("detention", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const d = await setStatus(v.id, "served", ctx);
    await audit(ctx, "detention.served", `${d.name} served detention`, { entity: "student", entityId: d.studentId });
    return { message: `${d.name} is free to go. Their phone is back to normal.` };
  });
}

/** Detention was a mistake (wrong student, wrong call). */
export async function cancelDetention(input: { id: number }): Promise<ActionResult> {
  return run("detention", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const d = await setStatus(v.id, "cancelled", ctx);
    await audit(ctx, "detention.cancel", `Detention cancelled for ${d.name}`, { entity: "student", entityId: d.studentId });
    return { message: `Detention cancelled for ${d.name}.` };
  });
}

/** Marked served by accident? Put them straight back. */
export async function reopenDetention(input: { id: number }): Promise<ActionResult> {
  return run("detention", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const d = await setStatus(v.id, "pending", ctx);
    await audit(ctx, "detention.reopen", `Detention re-opened for ${d.name}`, { entity: "student", entityId: d.studentId });
    return { message: `${d.name} is back in detention.` };
  });
}

/** A team detention (from a caught Principal's Office attempt) is served together: release several at once. */
export async function markDetentionsServed(input: { ids: number[] }): Promise<ActionResult> {
  return run("detention", async (ctx) => {
    const v = parse(z.object({ ids: z.array(id).min(1).max(100) }), input);
    let n = 0;
    for (const detentionId of v.ids) {
      const rows = await ctx.sql`update detentions set status = 'served', released_at = now(), released_by = ${ctx.actor.id}
        where id = ${detentionId} and status = 'pending' returning id`;
      n += rows.length;
    }
    if (!n) throw new UserError("Nobody in that group is still in detention.");
    await audit(ctx, "detention.served", `${n} student${n === 1 ? "" : "s"} served detention together`);
    return { message: `${n} student${n === 1 ? "" : "s"} released. Their phones are back to normal.` };
  });
}
