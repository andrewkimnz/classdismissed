import type { Sql } from "@/lib/db/sql";
import type {
  AttemptRow, BoundaryRow, ClassRow, ClubRow, CompletionRow, DetentionRow, EventRow, ModificationRow,
  NoteRow, PeriodRow, RiskTierRow, RotationRow, ScoreRow, StudentRow, SubjectRow, World,
} from "@/lib/types";

/**
 * Loads everything a screen could need. The event is tiny (≈60 students), so
 * one parallel batch of small queries + pure functions in domain/ is simpler
 * and more reliable than bespoke SQL per screen. Login codes are deliberately
 * NOT loaded here, so a student object can never leak one to a browser.
 */
export async function loadWorld(sql: Sql): Promise<World> {
  const [
    events, classes, students, subjects, periods, rotations, scores, boundaries,
    clubs, completions, notes, attempts, mods, detentions, tiers,
  ] = await Promise.all([
    sql<EventRow>`select *, event_date::text as event_date from events where id = 1`,
    sql<ClassRow>`
      select c.*, (select p.url from photos p where p.class_id = c.id and p.kind = 'class_team' and p.is_current limit 1) as team_photo_url
      from classes c order by c.sort_order, c.id`,
    sql<StudentRow>`
      select s.id, s.student_no, s.name, s.class_id, s.attendance, s.checked_in_at, s.custom_award, s.notes, s.created_at,
        (select p.url from photos p where p.student_id = s.id and p.kind = 'student_id' and p.is_current limit 1) as photo_url,
        (select p.url from photos p where p.student_id = s.id and p.kind = 'final' and p.is_current limit 1) as final_photo_url
      from students s order by s.student_no`,
    sql<SubjectRow>`select * from subjects order by sort_order, id`,
    sql<PeriodRow>`select * from periods order by number`,
    sql<RotationRow>`select * from rotations`,
    sql<ScoreRow>`select * from class_subject_scores`,
    sql<BoundaryRow>`select * from grade_boundaries order by min_percent desc`,
    sql<ClubRow>`select * from clubs where archived_at is null order by sort_order, id`,
    sql<CompletionRow>`select * from club_completions where revoked_at is null`,
    sql<NoteRow>`select * from teacher_notes where revoked_at is null`,
    sql<AttemptRow>`select * from principal_attempts order by id`,
    sql<ModificationRow>`select * from grade_modifications where revoked_at is null order by id`,
    sql<DetentionRow>`select * from detentions order by id`,
    sql<RiskTierRow>`select * from risk_tiers order by sort_order, id`,
  ]);
  if (!events[0]) throw new Error("Database has no event row. Run `npm run db:migrate`.");
  return {
    event: events[0], classes, students, subjects, periods, rotations, scores, boundaries,
    clubs, completions, notes, attempts, mods, detentions, tiers,
  };
}
