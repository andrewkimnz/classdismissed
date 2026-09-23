"use server";

import { z } from "zod";
import { audit, parse, run, runAsStudent, UserError, type ActionResult } from "@/lib/actions";
import { rateLimited } from "@/lib/auth/rate-limit";
import { clearTossWindow, getActiveChallenge } from "@/lib/data/math";
import { getWorld } from "@/lib/data/world";
import { currentMathsSlot, generateMathQuestion } from "@/lib/domain/math";
import { resetMathChallenges } from "@/lib/reset";

const id = z.number().int().positive();
const WIN_STREAK = 3;

/** A student answers their current question. Wrong just resets the streak and hands them a new one. */
export async function submitMathAnswer(input: { answer: number }): Promise<ActionResult<{ correct: boolean; won: boolean }>> {
  return runAsStudent<{ correct: boolean; won: boolean }>(async (ctx) => {
    if (rateLimited(`math:${ctx.studentId}`, 30, 60_000)) throw new UserError("Slow down a little, then try again.");
    const v = parse(z.object({ answer: z.coerce.number() }), input);

    const world = await getWorld();
    const student = world.students.find((s) => s.id === ctx.studentId);
    if (!student) throw new UserError("Couldn't find your account. Reload and sign in again.");
    const slot = currentMathsSlot(world, student.classId);
    if (!slot) throw new UserError("Maths isn't your class's current class right now.");

    const row = await getActiveChallenge(ctx.sql, ctx.studentId, slot.periodId);
    if (row.status !== "playing") {
      return { message: "You're mid-toss! Once your window ends you can play for another.", data: { correct: true, won: true } };
    }

    const correct = row.answer !== null && Math.round(v.answer) === row.answer;
    const streak = correct ? row.streak + 1 : 0;
    const attempts = row.attempts + 1;

    if (correct && streak >= WIN_STREAK) {
      await ctx.sql`
        update math_challenges set streak = ${streak}, attempts = ${attempts}, question = null, answer = null, status = 'ready', won_at = now()
        where id = ${row.id}`;
      const klass = world.classes.find((c) => c.id === student.classId);
      await ctx.sql`
        insert into audit_log (admin_name, action, entity, entity_id, summary)
        values (${student.name}, 'math.win', 'math_challenge', ${row.id}, ${`${student.name}${klass ? ` (${klass.name})` : ""} is ready to toss`})`;
      return { message: "3 in a row! Go find the Maths table.", data: { correct: true, won: true } };
    }

    const q = generateMathQuestion();
    await ctx.sql`update math_challenges set streak = ${streak}, attempts = ${attempts}, question = ${q.text}, answer = ${q.answer} where id = ${row.id}`;
    return { message: correct ? "Correct!" : "Not quite — try again.", data: { correct, won: false } };
  });
}

/**
 * An exec ends a "go toss it" window early (they saw the toss happen, or fixing a mis-tap). Normally
 * nobody needs to touch this: the window closes itself after a few seconds either way.
 */
export async function clearMathToss(input: { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id }), input);
    const row = await clearTossWindow(ctx.sql, v.id, ctx.actor.id);
    if (!row) throw new UserError("That entry isn't waiting to toss any more.");
    await audit(ctx, "math.toss", `${row.name}'s toss window cleared`, { entity: "math_challenge", entityId: v.id });
    return { message: `${row.name} can play for another toss.` };
  });
}

/**
 * Ends the current Maths-toss session and starts a new one: every student's streak/tosses clear, back
 * to their first question next time they open the tab. Doesn't touch anything else — a new rotation
 * already puts different classes in Maths, so this is also run automatically when the bell rings
 * (see setCurrentPeriod in src/actions/event.ts).
 */
export async function resetMathSession(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const [{ n }] = await ctx.sql<{ n: number }>`select count(*)::int as n from math_challenges`;
    await resetMathChallenges(ctx.sql);
    await audit(ctx, "math.reset", `Maths: started a new session (cleared ${n} ${n === 1 ? "student's" : "students'"} progress)`, { entity: "math_challenges" });
    return { message: "New session started." };
  });
}
