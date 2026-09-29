import type { Sql } from "@/lib/db/sql";
import type { AttemptRow } from "@/lib/types";
import { UserError } from "@/lib/actions";

/** Undo everything an attempt did to grades and detention (idempotent). */
export async function reverseAttemptEffects(sql: Sql, attemptId: number, actorId: number, reason: string) {
  await sql`update grade_modifications set revoked_at = now(), revoked_by = ${actorId}, revoke_reason = ${reason}
    where attempt_id = ${attemptId} and revoked_at is null`;
  await sql`update detentions set status = 'cancelled', released_at = now(), released_by = ${actorId}
    where attempt_id = ${attemptId} and status <> 'cancelled'`;
}

/**
 * Record (or correct) the outcome of a class's attempt. If it was already resolved, its
 * old grade change and detentions are reversed first, so flipping success ↔ failure
 * is one safe step. A caught result sends the WHOLE class to detention.
 */
export async function applyOutcome(
  sql: Sql,
  opts: { attemptId: number; outcome: "success" | "failure"; notes?: string; actorId: number },
): Promise<{ attempt: AttemptRow; delta: number; detained: boolean }> {
  const [attempt] = await sql<AttemptRow>`select * from principal_attempts where id = ${opts.attemptId} for update`;
  if (!attempt) throw new UserError("That attempt no longer exists.");
  if (attempt.status === "cancelled" || attempt.status === "voided") {
    throw new UserError("That attempt was cancelled. Start a new one.");
  }
  if (attempt.status === "resolved") {
    await reverseAttemptEffects(sql, attempt.id, opts.actorId, "Outcome corrected");
  }

  // The whole class made this attempt, so a caught result affects the whole class.
  const [klass] = await sql<{ id: number; name: string }>`select id, name from classes where id = ${attempt.classId}`;
  if (!klass) throw new UserError("That class no longer exists.");

  const delta = opts.outcome === "success" ? attempt.successDelta : attempt.failureDelta;
  const detained = opts.outcome === "failure" && attempt.failureDetention;

  const [updated] = await sql<AttemptRow>`
    update principal_attempts set status = 'resolved', outcome = ${opts.outcome}, delta_applied = ${delta},
      notes = ${opts.notes ?? attempt.notes}, resolved_at = now(), resolved_by = ${opts.actorId},
      voided_at = null, void_reason = null
    where id = ${attempt.id} returning *`;

  if (delta !== 0) {
    await sql`insert into grade_modifications (class_id, attempt_id, kind, delta_percent, reason, created_by)
      values (${klass.id}, ${attempt.id}, 'principal_attempt', ${delta},
              ${`${attempt.tierName} attempt: ${opts.outcome}`}, ${opts.actorId})`;
  }
  if (detained) {
    // Everyone who is here goes (absent students weren't part of the team run).
    const [ev] = await sql<{ detentionRoom: string }>`select detention_room from events where id = 1`;
    await sql`insert into detentions (student_id, attempt_id, reason, room, created_by)
      select s.id, ${attempt.id}::int, 'Caught attempting to alter school records', ${ev.detentionRoom}::text, ${opts.actorId}::int
      from students s where s.class_id = ${klass.id} and s.attendance <> 'absent'`;
  }
  return { attempt: updated, delta, detained };
}
