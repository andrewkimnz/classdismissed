"use server";

import { z } from "zod";
import { audit, parse, run, runAsStudent, UserError, type ActionResult } from "@/lib/actions";
import { rateLimited } from "@/lib/auth/rate-limit";
import { getWorld } from "@/lib/data/world";
import { currentBuzzerSlot } from "@/lib/domain/buzzer";

/** A student buzzes in. The first one to reach the database wins — the UPDATE's WHERE clause is what
 * makes that atomic: only a request that finds the round still unclaimed can claim it. */
export async function buzzIn(): Promise<ActionResult<{ won: boolean }>> {
  return runAsStudent<{ won: boolean }>(async (ctx) => {
    if (rateLimited(`buzz:${ctx.studentId}`, 20, 60_000)) throw new UserError("Slow down a little, then try again.");

    const world = await getWorld();
    const student = world.students.find((s) => s.id === ctx.studentId);
    if (!student) throw new UserError("Couldn't find your account. Reload and sign in again.");
    if (!currentBuzzerSlot(world, student.classId)) throw new UserError("Buzzer isn't your class's current class right now.");

    const [state] = await ctx.sql<{ questionNumber: number }>`select question_number from buzzer_state where id = 1`;
    if (!state || state.questionNumber < 1) throw new UserError("The round hasn't started yet.");

    const claimed = await ctx.sql<{ id: number }>`
      update buzzer_state set buzzed_student_id = ${ctx.studentId}, buzzed_at = now(), result = null
      where id = 1 and question_number = ${state.questionNumber} and buzzed_student_id is null
      returning id`;
    if (!claimed.length) return { message: "Someone beat you to it!", data: { won: false } };
    return { message: "You buzzed in first!", data: { won: true } };
  });
}

/** Moves from "start of round" (0) to Q1, then Q2, … A still-unresolved buzz is logged "unanswered" first. */
export async function nextBuzzerQuestion(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const [state] = await ctx.sql<{ questionNumber: number; buzzedStudentId: number | null; result: string | null }>`
      select question_number, buzzed_student_id, result from buzzer_state where id = 1`;
    if (state.buzzedStudentId !== null && state.result === null) {
      const [student] = await ctx.sql<{ classId: number | null }>`select class_id from students where id = ${state.buzzedStudentId}`;
      await ctx.sql`
        insert into buzzer_rounds (question_number, student_id, class_id, buzzed_at, result, resolved_by)
        values (${state.questionNumber}, ${state.buzzedStudentId}, ${student?.classId ?? null}, now(), 'unanswered', ${ctx.actor.id})`;
    }
    const next = state.questionNumber + 1;
    await ctx.sql`update buzzer_state set question_number = ${next}, buzzed_student_id = null, buzzed_at = null, result = null where id = 1`;
    await audit(ctx, "buzzer.next", `Buzzer: moved to question ${next}`, { entity: "buzzer_state" });
    return { message: `Now on question ${next}.` };
  });
}

/** Marks the current buzz correct or wrong, and logs it to the scoreboard. */
export async function resolveBuzz(input: { result: "correct" | "wrong" }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ result: z.enum(["correct", "wrong"]) }), input);
    const [state] = await ctx.sql<{ questionNumber: number; buzzedStudentId: number | null; result: string | null }>`
      select question_number, buzzed_student_id, result from buzzer_state where id = 1`;
    if (state.buzzedStudentId === null) throw new UserError("Nobody's buzzed in yet.");
    if (state.result !== null) throw new UserError("Already marked.");
    const [student] = await ctx.sql<{ name: string; classId: number | null }>`select name, class_id from students where id = ${state.buzzedStudentId}`;
    await ctx.sql`update buzzer_state set result = ${v.result} where id = 1`;
    await ctx.sql`
      insert into buzzer_rounds (question_number, student_id, class_id, buzzed_at, result, resolved_by)
      values (${state.questionNumber}, ${state.buzzedStudentId}, ${student?.classId ?? null}, now(), ${v.result}, ${ctx.actor.id})`;
    await audit(ctx, "buzzer.resolve", `Buzzer Q${state.questionNumber}: ${student?.name ?? "a student"} marked ${v.result}`, { entity: "buzzer_state" });
    return { message: `Marked ${v.result}.` };
  });
}

/** Undoes a mis-tap or wrong buzz without advancing the question or touching the scoreboard: buzzing opens again for the same question. */
export async function clearBuzz(): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const rows = await ctx.sql<{ id: number }>`
      update buzzer_state set buzzed_student_id = null, buzzed_at = null, result = null where id = 1 and buzzed_student_id is not null returning id`;
    if (!rows.length) throw new UserError("Nobody's buzzed in.");
    await audit(ctx, "buzzer.clear", "Buzzer: cleared the buzz, open again", { entity: "buzzer_state" });
    return { message: "Cleared. Buzzing is open again for this question." };
  });
}
