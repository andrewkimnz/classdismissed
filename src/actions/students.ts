"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { generateLoginCode, studentTag } from "@/lib/auth/codes";
import { isUniqueViolation } from "@/lib/db/sql";
import type { Sql } from "@/lib/db/sql";

const id = z.number().int().positive();
const name = z.string().trim().min(1, "Name is required").max(80);

async function nextStudentNo(sql: Sql): Promise<number> {
  // Fill the lowest free number so cards stay compact (KAC-001…).
  const rows = await sql<{ n: number }>`
    select g.n from generate_series(1, (select coalesce(max(student_no), 0) + 1 from students)) as g(n)
    where not exists (select 1 from students where student_no = g.n) order by g.n limit 1`;
  return rows[0].n;
}

async function uniqueCode(sql: Sql): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateLoginCode();
    if (!(await sql`select 1 from students where login_code = ${code}`).length) return code;
  }
  throw new UserError("Couldn't generate a unique code. Try again.");
}

async function smallestClassId(sql: Sql): Promise<number | null> {
  const rows = await sql<{ id: number }>`
    select c.id from classes c left join students s on s.class_id = c.id
    group by c.id, c.sort_order order by count(s.id), c.sort_order limit 1`;
  return rows[0]?.id ?? null;
}

export async function createStudent(input: { name: string; classId: number | null; studentNo?: number | null }): Promise<ActionResult<{ id: number }>> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ name, classId: id.nullable(), studentNo: id.nullish() }), input);
    const studentNo = v.studentNo ?? (await nextStudentNo(ctx.sql));
    try {
      const [row] = await ctx.sql<{ id: number }>`
        insert into students (student_no, name, class_id, login_code)
        values (${studentNo}, ${v.name}, ${v.classId}, ${await uniqueCode(ctx.sql)}) returning id`;
      await audit(ctx, "student.create", `Added ${v.name} (${studentTag(studentNo)})`, { entity: "student", entityId: row.id });
      return { message: `Added ${v.name} as ${studentTag(studentNo)}.`, data: { id: row.id } };
    } catch (e) {
      if (isUniqueViolation(e)) throw new UserError(`${studentTag(studentNo)} is already taken.`);
      throw e;
    }
  });
}

export async function updateStudent(input: {
  id: number; name: string; classId: number | null; studentNo: number; customAward: string; notes: string;
}): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id, name, classId: id.nullable(), studentNo: id, customAward: z.string().trim().max(60), notes: z.string().trim().max(500) }), input);
    try {
      const rows = await ctx.sql`
        update students set name = ${v.name}, class_id = ${v.classId}, student_no = ${v.studentNo},
          custom_award = ${v.customAward || null}, notes = ${v.notes} where id = ${v.id} returning id`;
      if (!rows.length) throw new UserError("That student no longer exists.");
    } catch (e) {
      if (isUniqueViolation(e)) throw new UserError(`${studentTag(v.studentNo)} is already taken.`);
      throw e;
    }
    await audit(ctx, "student.update", `Updated ${v.name}`, { entity: "student", entityId: v.id, data: v });
    return { message: "Student saved." };
  });
}

export async function setAttendance(input: { id: number; attendance: "expected" | "present" | "absent" }): Promise<ActionResult> {
  return run("checkin", async (ctx) => {
    const v = parse(z.object({ id, attendance: z.enum(["expected", "present", "absent"]) }), input);
    const rows = await ctx.sql<{ name: string }>`
      update students set attendance = ${v.attendance},
        checked_in_at = case when ${v.attendance}::text = 'present' then coalesce(checked_in_at, now()) else null end
      where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That student no longer exists.");
    await audit(ctx, "student.attendance", `${rows[0].name} marked ${v.attendance}`, { entity: "student", entityId: v.id });
    return { message: `${rows[0].name}: ${v.attendance}.` };
  });
}

export async function deleteStudent(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const rows = await ctx.sql<{ name: string; studentNo: number }>`select name, student_no from students where id = ${v.id}`;
    if (!rows.length) throw new UserError("That student was already removed.");
    await ctx.sql`delete from students where id = ${v.id}`;
    await audit(ctx, "student.delete", `Deleted ${rows[0].name} (${studentTag(rows[0].studentNo)}) and all their records`, { entity: "student", entityId: v.id, data: rows[0] });
    return { message: `${rows[0].name} removed.` };
  });
}

/** New code + signs the student out of every phone. For lost cards / phone swaps gone wrong. */
export async function regenerateLoginCode(input: { id: number }): Promise<ActionResult<{ code: string }>> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const code = await uniqueCode(ctx.sql);
    const rows = await ctx.sql<{ name: string }>`
      update students set login_code = ${code}, session_version = session_version + 1 where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That student no longer exists.");
    await audit(ctx, "student.new_code", `New login code issued for ${rows[0].name}`, { entity: "student", entityId: v.id });
    return { message: `New code for ${rows[0].name}: ${code.slice(0, 3)}-${code.slice(3)}`, data: { code } };
  });
}

/** Sign a student out of all phones but keep their code (someone borrowed a phone). */
export async function signOutEverywhere(input: { id: number }): Promise<ActionResult> {
  return run("checkin", async (ctx) => {
    const v = parse(z.object({ id }), input);
    await ctx.sql`update students set session_version = session_version + 1 where id = ${v.id}`;
    await audit(ctx, "student.signout", "Signed a student out of all devices", { entity: "student", entityId: v.id });
    return { message: "Signed out everywhere. Their code still works." };
  });
}

/**
 * Paste a list, one student per line: "Name" or "Name, 2-B". Numbers and login
 * codes are generated. Unplaced students go to whichever class is smallest, so
 * classes stay balanced even when attendance is uneven.
 */
export async function importStudents(input: { text: string }): Promise<ActionResult<{ added: number; skipped: string[] }>> {
  return run("manage", async (ctx) => {
    const { text } = parse(z.object({ text: z.string().min(1, "Paste at least one name").max(20000) }), input);
    const classes = await ctx.sql<{ id: number; name: string }>`select id, name from classes`;
    const existing = new Set((await ctx.sql<{ name: string }>`select lower(name) as name from students`).map((r) => r.name));
    const skipped: string[] = [];
    let added = 0;
    for (const line of text.split(/\r?\n/)) {
      const [rawName, rawClass] = line.split(/[,\t]/).map((s) => s.trim());
      if (!rawName) continue;
      if (existing.has(rawName.toLowerCase())) {
        skipped.push(rawName);
        continue;
      }
      const named = rawClass ? classes.find((c) => c.name.toLowerCase() === rawClass.toLowerCase()) : undefined;
      const classId = named?.id ?? (await smallestClassId(ctx.sql));
      await ctx.sql`insert into students (student_no, name, class_id, login_code)
        values (${await nextStudentNo(ctx.sql)}, ${rawName.slice(0, 80)}, ${classId}, ${await uniqueCode(ctx.sql)})`;
      existing.add(rawName.toLowerCase());
      added++;
    }
    await audit(ctx, "student.import", `Imported ${added} students${skipped.length ? ` (${skipped.length} duplicates skipped)` : ""}`);
    return { message: `Added ${added} student${added === 1 ? "" : "s"}${skipped.length ? `; skipped ${skipped.length} already on the list` : ""}.`, data: { added, skipped } };
  });
}

/** Put every unassigned student into the smallest class. */
export async function autoAssignUnassigned(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const rows = await ctx.sql<{ id: number }>`select id from students where class_id is null order by student_no`;
    for (const s of rows) {
      await ctx.sql`update students set class_id = ${await smallestClassId(ctx.sql)} where id = ${s.id}`;
    }
    await audit(ctx, "student.auto_assign", `Auto-assigned ${rows.length} students to balance classes`);
    return { message: rows.length ? `Assigned ${rows.length} students to the smallest classes.` : "Everyone already has a class." };
  });
}

/** Set (or clear) the personalised special award shown on a student's final keepsake. */
export async function setCustomAward(input: { id: number; award: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id, award: z.string().trim().max(60) }), input);
    const rows = await ctx.sql<{ name: string }>`update students set custom_award = ${v.award || null} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That student no longer exists.");
    await audit(ctx, "student.award", `${rows[0].name}'s award: ${v.award || "(automatic)"}`, { entity: "student", entityId: v.id });
    return { message: v.award ? `${rows[0].name} will receive “${v.award.toUpperCase()}”.` : `${rows[0].name}'s award is automatic again.` };
  });
}
