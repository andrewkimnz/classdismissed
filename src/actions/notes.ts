"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { isUniqueViolation } from "@/lib/db/sql";

const id = z.number().int().positive();

/**
 * "This class finished this club." The team walks around together, so the class is
 * what completes a club and earns its Teacher's Note (if the club awards one).
 * Safe to double-tap: a class can only complete a club once, so repeats are
 * reported, never duplicated.
 */
export async function awardClub(input: { classIds: number[]; clubId: number }): Promise<ActionResult<{ awarded: string[]; already: string[] }>> {
  return run("notes", async (ctx) => {
    const v = parse(z.object({ classIds: z.array(id).min(1, "Pick a class").max(20), clubId: id }), input);
    const [club] = await ctx.sql<{ name: string; awardsNote: boolean; archivedAt: Date | null }>`select name, awards_note, archived_at from clubs where id = ${v.clubId}`;
    if (!club || club.archivedAt) throw new UserError("That club isn't available any more.");
    const awarded: string[] = [];
    const already: string[] = [];
    for (const classId of v.classIds) {
      const [klass] = await ctx.sql<{ name: string }>`select name from classes where id = ${classId}`;
      if (!klass) continue;
      const label = `Class ${klass.name}`;
      try {
        // A savepoint per class so one duplicate doesn't abort the whole batch.
        await ctx.sql`savepoint award`;
        const [comp] = await ctx.sql<{ id: number }>`
          insert into club_completions (class_id, club_id, awarded_by) values (${classId}, ${v.clubId}, ${ctx.actor.id}) returning id`;
        if (club.awardsNote) {
          await ctx.sql`insert into teacher_notes (class_id, club_id, completion_id, issued_by) values (${classId}, ${v.clubId}, ${comp.id}, ${ctx.actor.id})`;
        }
        await ctx.sql`release savepoint award`;
        awarded.push(label);
      } catch (e) {
        await ctx.sql`rollback to savepoint award`;
        if (isUniqueViolation(e)) already.push(label);
        else throw e;
      }
    }
    if (awarded.length) {
      await audit(ctx, "club.complete", `${club.name}: ${club.awardsNote ? "Teacher's Note" : "completion"} → ${awarded.join(", ")}`, {
        entity: "club", entityId: v.clubId, data: { classIds: v.classIds },
      });
    }
    if (!awarded.length) throw new UserError(`${already.join(", ")} already ${already.length === 1 ? "has" : "have"} ${club.name} done. Nothing was added twice.`);
    const what = club.awardsNote ? "Teacher's Note" : "completion";
    return {
      message: `${what} for ${awarded.join(", ")} (${club.name}).${already.length ? ` Already done: ${already.join(", ")}.` : ""}`,
      data: { awarded, already },
    };
  });
}

/** A note with no club behind it (a reward from a game master, a make-good…), given to a class. */
export async function awardBonusNote(input: { classId: number; reason: string }): Promise<ActionResult> {
  return run("notes", async (ctx) => {
    const v = parse(z.object({ classId: id, reason: z.string().trim().min(1, "Say what it's for").max(140) }), input);
    const [klass] = await ctx.sql<{ name: string }>`select name from classes where id = ${v.classId}`;
    if (!klass) throw new UserError("That class no longer exists.");
    await ctx.sql`insert into teacher_notes (class_id, reason, issued_by) values (${v.classId}, ${v.reason}, ${ctx.actor.id})`;
    await audit(ctx, "note.bonus", `Bonus note for Class ${klass.name}: ${v.reason}`, { entity: "class", entityId: v.classId });
    return { message: `Bonus Teacher's Note for Class ${klass.name}.` };
  });
}

/** Undo a completion (and the note it earned). The row stays for the audit trail. */
export async function revokeCompletion(input: { completionId: number; reason?: string }): Promise<ActionResult> {
  return run("notes", async (ctx) => {
    const v = parse(z.object({ completionId: id, reason: z.string().trim().max(200).optional() }), input);
    const rows = await ctx.sql<{ classId: number; clubId: number }>`
      update club_completions set revoked_at = now(), revoked_by = ${ctx.actor.id}, revoke_reason = ${v.reason ?? "Revoked by staff"}
      where id = ${v.completionId} and revoked_at is null returning class_id, club_id`;
    if (!rows.length) throw new UserError("That was already revoked.");
    await ctx.sql`update teacher_notes set revoked_at = now(), revoked_by = ${ctx.actor.id}, revoke_reason = ${v.reason ?? "Completion revoked"}
      where completion_id = ${v.completionId} and revoked_at is null`;
    await audit(ctx, "club.revoke", "Club completion revoked", { entity: "class", entityId: rows[0].classId, data: v });
    return { message: "Revoked. The class's notes have been updated." };
  });
}

export async function revokeNote(input: { noteId: number; reason?: string }): Promise<ActionResult> {
  return run("notes", async (ctx) => {
    const v = parse(z.object({ noteId: id, reason: z.string().trim().max(200).optional() }), input);
    const rows = await ctx.sql<{ classId: number }>`
      update teacher_notes set revoked_at = now(), revoked_by = ${ctx.actor.id}, revoke_reason = ${v.reason ?? "Revoked by staff"}
      where id = ${v.noteId} and revoked_at is null returning class_id`;
    if (!rows.length) throw new UserError("That was already revoked.");
    await audit(ctx, "note.revoke", "Teacher's Note revoked", { entity: "class", entityId: rows[0].classId, data: v });
    return { message: "Teacher's Note revoked." };
  });
}
