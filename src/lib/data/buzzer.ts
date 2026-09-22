import { cache } from "react";
import { sql as globalSql } from "@/lib/db/client";

/**
 * The live round, joined with whoever buzzed in (if anyone): their name, class and ID photo, so an
 * exec at the front of the room — or the TV — knows who to hand the question to. Nothing here is
 * sensitive; it's the same name/class already shown everywhere in the app, plus the photo every
 * student's own ID card already carries. Safe to show on an unauthenticated screen.
 */
export interface BuzzerLive {
  questionNumber: number;
  buzzedStudentId: number | null;
  buzzedStudentName: string | null;
  classId: number | null;
  className: string | null;
  classColor: string | null;
  photoUrl: string | null;
  buzzedAt: Date | null;
  result: "correct" | "wrong" | null;
}

const IDLE: BuzzerLive = {
  questionNumber: 0, buzzedStudentId: null, buzzedStudentName: null, classId: null, className: null, classColor: null, photoUrl: null, buzzedAt: null, result: null,
};

export const getBuzzerLive = cache(async (): Promise<BuzzerLive> => {
  const [row] = await globalSql<BuzzerLive>`
    select b.question_number, b.buzzed_student_id, s.name as buzzed_student_name, s.class_id, c.name as class_name, c.color as class_color,
      (select p.url from photos p where p.student_id = s.id and p.kind = 'student_id' and p.is_current limit 1) as photo_url,
      b.buzzed_at, b.result
    from buzzer_state b
    left join students s on s.id = b.buzzed_student_id
    left join classes c on c.id = s.class_id
    where b.id = 1`;
  // The singleton row should always exist (the migration inserts it), but every screen that reads
  // this — including two public, unauthenticated ones — must never crash if something odd happened to it.
  return row ?? IDLE;
});

export interface BuzzerRoundRow {
  id: number;
  questionNumber: number;
  studentName: string | null;
  className: string | null;
  classColor: string | null;
  result: "correct" | "wrong" | "unanswered";
  resolvedAt: Date;
}

/** The scoreboard: every resolved question, newest first. */
export const getBuzzerHistory = cache(async (limit = 100): Promise<BuzzerRoundRow[]> =>
  globalSql<BuzzerRoundRow>`
    select r.id, r.question_number, s.name as student_name, c.name as class_name, c.color as class_color, r.result, r.resolved_at
    from buzzer_rounds r
    left join students s on s.id = r.student_id
    left join classes c on c.id = r.class_id
    order by r.id desc
    limit ${limit}`);

export interface ClassTally {
  classId: number;
  className: string;
  classColor: string;
  correct: number;
  wrong: number;
}

/** Correct/wrong counts per class, for a running scoreboard. Classes with no rounds yet are omitted. */
export const getBuzzerTally = cache(async (): Promise<ClassTally[]> =>
  globalSql<ClassTally>`
    select c.id as class_id, c.name as class_name, c.color as class_color,
      count(*) filter (where r.result = 'correct')::int as correct,
      count(*) filter (where r.result = 'wrong')::int as wrong
    from buzzer_rounds r join classes c on c.id = r.class_id
    group by c.id, c.name, c.color
    order by correct desc, c.sort_order`);
