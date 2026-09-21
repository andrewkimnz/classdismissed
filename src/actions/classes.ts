"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { isUniqueViolation } from "@/lib/db/sql";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");
const fields = {
  name: z.string().trim().min(1, "Class name is required").max(20),
  color: hex,
  sortOrder: z.number().int().min(0).max(999),
};

export async function createClass(input: { name: string; color: string; sortOrder: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object(fields), input);
    try {
      await ctx.sql`insert into classes (name, color, sort_order) values (${v.name}, ${v.color}, ${v.sortOrder})`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new UserError(`A class called ${v.name} already exists.`);
      throw e;
    }
    await audit(ctx, "class.create", `Created class ${v.name}`);
    return { message: `Class ${v.name} created.` };
  });
}

export async function updateClass(input: { id: number; name: string; color: string; sortOrder: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id: z.number().int().positive(), ...fields }), input);
    try {
      const rows = await ctx.sql`update classes set name = ${v.name}, color = ${v.color}, sort_order = ${v.sortOrder} where id = ${v.id} returning id`;
      if (!rows.length) throw new UserError("That class no longer exists.");
    } catch (e) {
      if (isUniqueViolation(e)) throw new UserError(`A class called ${v.name} already exists.`);
      throw e;
    }
    await audit(ctx, "class.update", `Updated class ${v.name}`, { entity: "class", entityId: v.id, data: v });
    return { message: `Class ${v.name} saved.` };
  });
}

/** Members become unassigned (nobody is deleted). Its scores and timetable go with it. */
export async function deleteClass(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { id } = parse(z.object({ id: z.number().int().positive() }), input);
    const rows = await ctx.sql<{ name: string }>`select name from classes where id = ${id}`;
    if (!rows.length) throw new UserError("Already deleted.");
    await ctx.sql`delete from classes where id = ${id}`;
    await audit(ctx, "class.delete", `Deleted class ${rows[0].name} (members are now unassigned)`, { entity: "class", entityId: id });
    return { message: `Class ${rows[0].name} deleted. Its members are unassigned.` };
  });
}
