"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { generateTimetable } from "@/lib/domain/timetable";
import { zonedToUtc } from "@/lib/domain/time";
import type { ClassRow, PeriodRow, SubjectRow } from "@/lib/types";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 18:30");

/** Replace the list of rotations (start/end times). Removed periods drop their cells. */
export async function savePeriods(input: { periods: { start: string; end: string }[] }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const { periods } = parse(z.object({ periods: z.array(z.object({ start: hhmm, end: hhmm })).min(1).max(12) }), input);
    const [ev] = await ctx.sql<{ eventDate: string; timezone: string }>`select event_date::text as event_date, timezone from events where id = 1`;
    const existing = await ctx.sql<{ id: number; number: number }>`select id, number from periods order by number`;
    for (const [i, p] of periods.entries()) {
      const n = i + 1;
      const start = zonedToUtc(ev.eventDate, p.start, ev.timezone);
      const end = zonedToUtc(ev.eventDate, p.end, ev.timezone);
      if (end <= start) throw new UserError(`Period ${n} must end after it starts.`);
      const prior = existing.find((e) => e.number === n);
      if (prior) await ctx.sql`update periods set starts_at = ${start}, ends_at = ${end} where id = ${prior.id}`;
      else await ctx.sql`insert into periods (number, starts_at, ends_at) values (${n}, ${start}, ${end})`;
    }
    for (const gone of existing.filter((e) => e.number > periods.length)) await ctx.sql`delete from periods where id = ${gone.id}`;
    await audit(ctx, "timetable.periods", `Rotation times saved (${periods.length} periods)`, { data: periods });
    return { message: "Rotation times saved." };
  });
}

/** Set one cell of the matrix. subjectId = null empties it. */
export async function setRotation(input: { periodId: number; classId: number; subjectId: number | null; room: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(
      z.object({ periodId: z.number().int().positive(), classId: z.number().int().positive(), subjectId: z.number().int().positive().nullable(), room: z.string().trim().max(40) }),
      input,
    );
    if (v.subjectId === null) {
      await ctx.sql`delete from rotations where period_id = ${v.periodId} and class_id = ${v.classId}`;
    } else {
      await ctx.sql`
        insert into rotations (period_id, class_id, subject_id, room) values (${v.periodId}, ${v.classId}, ${v.subjectId}, ${v.room})
        on conflict (period_id, class_id) do update set subject_id = excluded.subject_id, room = excluded.room`;
    }
    await audit(ctx, "timetable.cell", "Timetable cell changed", { data: v });
    return { message: "Timetable updated." };
  });
}

/** Last-minute room swap. Admin only. */
export async function setRotationRoom(input: { periodId: number; classId: number; room: string }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ periodId: z.number().int().positive(), classId: z.number().int().positive(), room: z.string().trim().max(40) }), input);
    const rows = await ctx.sql`update rotations set room = ${v.room} where period_id = ${v.periodId} and class_id = ${v.classId} returning id`;
    if (!rows.length) throw new UserError("That class has no subject in that period yet.");
    await audit(ctx, "timetable.room", `Room changed to ${v.room || "(blank)"}`, { data: v });
    return { message: `Room updated to ${v.room || "blank"}. Phones update automatically.` };
  });
}

/** Wipe the grid and rebuild it as a collision-free rotation. */
export async function generateRotations(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const classes = await ctx.sql<ClassRow>`select * from classes order by sort_order, id`;
    const periods = await ctx.sql<PeriodRow>`select * from periods order by number`;
    const subjects = await ctx.sql<SubjectRow>`select * from subjects where active order by sort_order, id`;
    if (!classes.length || !periods.length || !subjects.length) throw new UserError("You need at least one class, period and subject first.");
    await ctx.sql`delete from rotations`;
    const cells = generateTimetable(classes, periods, subjects);
    for (const c of cells) {
      await ctx.sql`insert into rotations (period_id, class_id, subject_id, room) values (${c.periodId}, ${c.classId}, ${c.subjectId}, ${c.room})`;
    }
    await audit(ctx, "timetable.generate", `Timetable regenerated (${cells.length} cells)`);
    return { message: `Timetable generated: ${classes.length} classes × ${periods.length} periods.` };
  });
}

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(40),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(400),
  activity: z.string().trim().max(600),
  icon: z.string().trim().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  maxScore: z.number().int().min(1).max(1000),
  rooms: z.string().max(200), // comma separated
  active: z.boolean(),
  isMathsChallenge: z.boolean(),
  isBuzzerChallenge: z.boolean(),
});
type SubjectInput = z.input<typeof subjectSchema>;

const roomsOf = (s: string) => s.split(",").map((r) => r.trim()).filter(Boolean);

export async function createSubject(input: SubjectInput): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(subjectSchema, input);
    // Only one subject runs each mini-game at a time (independently of each other).
    if (v.isMathsChallenge) await ctx.sql`update subjects set is_maths_challenge = false`;
    if (v.isBuzzerChallenge) await ctx.sql`update subjects set is_buzzer_challenge = false`;
    await ctx.sql`
      insert into subjects (name, tagline, description, activity, icon, color, max_score, rooms, active, is_maths_challenge, is_buzzer_challenge, sort_order)
      values (${v.name}, ${v.tagline}, ${v.description}, ${v.activity}, ${v.icon}, ${v.color}, ${v.maxScore}, ${roomsOf(v.rooms)}::jsonb, ${v.active}, ${v.isMathsChallenge}, ${v.isBuzzerChallenge},
              (select coalesce(max(sort_order), 0) + 1 from subjects))`;
    await audit(ctx, "subject.create", `Created subject ${v.name}`);
    return { message: `${v.name} added.` };
  });
}

export async function updateSubject(input: SubjectInput & { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(subjectSchema.extend({ id: z.number().int().positive() }), input);
    if (v.isMathsChallenge) await ctx.sql`update subjects set is_maths_challenge = false where id <> ${v.id}`;
    if (v.isBuzzerChallenge) await ctx.sql`update subjects set is_buzzer_challenge = false where id <> ${v.id}`;
    const rows = await ctx.sql`
      update subjects set name = ${v.name}, tagline = ${v.tagline}, description = ${v.description}, activity = ${v.activity},
        icon = ${v.icon}, color = ${v.color}, max_score = ${v.maxScore}, rooms = ${roomsOf(v.rooms)}::jsonb, active = ${v.active},
        is_maths_challenge = ${v.isMathsChallenge}, is_buzzer_challenge = ${v.isBuzzerChallenge}
      where id = ${v.id} returning id`;
    if (!rows.length) throw new UserError("That subject no longer exists.");
    await audit(ctx, "subject.update", `Updated subject ${v.name}`, { entity: "subject", entityId: v.id, data: v });
    return { message: `${v.name} saved.` };
  });
}
