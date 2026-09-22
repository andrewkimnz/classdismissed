import { cache } from "react";
import { sql as globalSql } from "@/lib/db/client";

/**
 * The live round, joined with whoever buzzed in (if anyone) and the current question (if the bank
 * has one at this position — see `buzzer_questions`). Nothing here is sensitive EXCEPT `correctIndex`:
 * that's redacted (null) until a buzz has actually been resolved, because this is read by two
 * unauthenticated, public screens (the student app and the TV) and must never spoil the answer before
 * the room finds out for real. `getBuzzerAdminLive` is the only read that always includes it — an exec
 * running the round needs to know the answer before marking someone right or wrong, not after.
 */
export interface BuzzerLive {
  questionNumber: number;
  questionText: string | null;
  choices: string[] | null;
  /** The correct choice's index, or null if not yet revealed (see the note above) or no question is loaded. */
  correctIndex: number | null;
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
  questionNumber: 0, questionText: null, choices: null, correctIndex: null, buzzedStudentId: null, buzzedStudentName: null,
  classId: null, className: null, classColor: null, photoUrl: null, buzzedAt: null, result: null,
};

/** Public-safe: student app and TV. The correct answer is redacted until a buzz is resolved. */
export const getBuzzerLive = cache(async (): Promise<BuzzerLive> => {
  const [row] = await globalSql<BuzzerLive>`
    select b.question_number, q.question as question_text, q.choices,
      case when b.result is not null then q.correct_index else null end as correct_index,
      b.buzzed_student_id, s.name as buzzed_student_name, s.class_id, c.name as class_name, c.color as class_color,
      (select p.url from photos p where p.student_id = s.id and p.kind = 'student_id' and p.is_current limit 1) as photo_url,
      b.buzzed_at, b.result
    from buzzer_state b
    left join students s on s.id = b.buzzed_student_id
    left join classes c on c.id = s.class_id
    left join lateral (select * from buzzer_questions order by sort_order, id offset greatest(b.question_number - 1, 0) limit 1) q
      on b.question_number >= 1
    where b.id = 1`;
  // The singleton row should always exist (the migration inserts it), but every screen that reads
  // this — including two public, unauthenticated ones — must never crash if something odd happened to it.
  return row ?? IDLE;
});

/** Admin-only: same shape, but the correct answer is always included — an exec needs it before marking, not after. */
export const getBuzzerAdminLive = cache(async (): Promise<BuzzerLive> => {
  const [row] = await globalSql<BuzzerLive>`
    select b.question_number, q.question as question_text, q.choices, q.correct_index,
      b.buzzed_student_id, s.name as buzzed_student_name, s.class_id, c.name as class_name, c.color as class_color,
      (select p.url from photos p where p.student_id = s.id and p.kind = 'student_id' and p.is_current limit 1) as photo_url,
      b.buzzed_at, b.result
    from buzzer_state b
    left join students s on s.id = b.buzzed_student_id
    left join classes c on c.id = s.class_id
    left join lateral (select * from buzzer_questions order by sort_order, id offset greatest(b.question_number - 1, 0) limit 1) q
      on b.question_number >= 1
    where b.id = 1`;
  return row ?? IDLE;
});

export interface BuzzerRoundRow {
  id: number;
  questionNumber: number;
  questionText: string | null;
  studentName: string | null;
  className: string | null;
  classColor: string | null;
  result: "correct" | "wrong" | "unanswered";
  resolvedAt: Date;
}

/** The scoreboard: every resolved question, newest first. */
export const getBuzzerHistory = cache(async (limit = 100): Promise<BuzzerRoundRow[]> =>
  globalSql<BuzzerRoundRow>`
    select r.id, r.question_number, r.question_text, s.name as student_name, c.name as class_name, c.color as class_color, r.result, r.resolved_at
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

export interface BuzzerQuestionRow {
  id: number;
  question: string;
  choices: string[];
  correctIndex: number;
  sortOrder: number;
}

/** The prepared question bank, in play order. Admin-only (carries the correct answer). */
export const getBuzzerQuestions = cache(async (): Promise<BuzzerQuestionRow[]> =>
  globalSql<BuzzerQuestionRow>`select id, question, choices, correct_index, sort_order from buzzer_questions order by sort_order, id`);
