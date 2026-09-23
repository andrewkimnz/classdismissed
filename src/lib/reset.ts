import type { Sql } from "@/lib/db/sql";

/**
 * "Start the event fresh".
 *
 * CLEARS everything that happened during the event: class scores, club completions and
 * Teacher's Notes, Principal's Office attempts, grade changes, detentions, check-ins
 * (everyone goes back to "expected"), custom awards. The event returns to School Day,
 * before the first bell, with scoring unlocked.
 *
 * KEEPS everything set up before the event: classes and their names/colours, students
 * (numbers, class, login codes, ID and team photos), clubs, subjects, timetable and rooms,
 * rules (notes per attempt, rooms), grade boundaries, risk tiers, staff accounts, and the
 * activity log (which records the reset itself).
 */
export interface ResetCounts {
  scores: number;
  notes: number;
  clubCompletions: number;
  attempts: number;
  gradeChanges: number;
  detentions: number;
  checkedIn: number;
  mathChallenges: number;
  buzzerRounds: number;
}

export async function countEventActivity(sql: Sql): Promise<ResetCounts> {
  const [r] = await sql<ResetCounts>`
    select
      (select count(*)::int from class_subject_scores) as scores,
      (select count(*)::int from teacher_notes) as notes,
      (select count(*)::int from club_completions) as club_completions,
      (select count(*)::int from principal_attempts) as attempts,
      (select count(*)::int from grade_modifications) as grade_changes,
      (select count(*)::int from detentions) as detentions,
      (select count(*)::int from students where attendance <> 'expected') as checked_in,
      (select count(*)::int from math_challenges) as math_challenges,
      (select count(*)::int from buzzer_rounds) as buzzer_rounds`;
  return r;
}

/** Clears everyone's Maths-toss progress (streaks, tosses, current question). Shared by the manual
 * "Reset session" button on the Maths tosses page, the rotation bell (a new rotation means different
 * classes are in Maths now), and "Start the event fresh". */
export async function resetMathChallenges(sql: Sql): Promise<void> {
  await sql`delete from math_challenges`;
}

/** Ends the current Buzzer session: the scoreboard and the live round both clear, back to "start of
 * round". Shared by the manual "Reset session" button, the rotation bell, and "Start the event fresh". */
export async function resetBuzzerSession(sql: Sql): Promise<void> {
  await sql`delete from buzzer_rounds`;
  await sql`update buzzer_state set question_number = 0, buzzed_student_id = null, buzzed_at = null, result = null where id = 1`;
}

/** Run inside a transaction. Returns what was cleared. */
export async function resetEventData(sql: Sql): Promise<ResetCounts> {
  const counts = await countEventActivity(sql);
  await resetMathChallenges(sql);
  await resetBuzzerSession(sql);
  await sql`delete from detentions`;
  await sql`delete from grade_modifications`;
  await sql`delete from principal_attempts`;
  await sql`delete from teacher_notes`;
  await sql`delete from club_completions`;
  await sql`delete from class_subject_scores`;
  await sql`update students set attendance = 'expected', checked_in_at = null, custom_award = null`;
  await sql`update events set phase = 'school_day', phase_changed_at = now(), current_period = 0, scoring_locked = false where id = 1`;
  return counts;
}
