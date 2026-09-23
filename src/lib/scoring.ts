import type { Sql } from "@/lib/db/sql";

/**
 * Adds `points` to a class's mark in one subject, creating the row if it doesn't have one yet, capped
 * at the subject's max so an automatic award (e.g. Buzzer) can never push a class over "out of N".
 * Writes to the same table Score entry does, so it shows up on the leaderboard immediately. Returns the
 * resulting score.
 */
export async function addSubjectPoints(
  sql: Sql,
  params: { classId: number; subjectId: number; points: number; maxScore: number; enteredBy: number },
): Promise<number> {
  const { classId, subjectId, points, maxScore, enteredBy } = params;
  const [row] = await sql<{ score: number }>`
    insert into class_subject_scores (class_id, subject_id, score, entered_by)
    values (${classId}, ${subjectId}, least(${points}::double precision, ${maxScore}::double precision), ${enteredBy})
    on conflict (class_id, subject_id) do update
      set score = least(class_subject_scores.score + ${points}::double precision, ${maxScore}::double precision), entered_by = excluded.entered_by
    returning score`;
  return row.score;
}
