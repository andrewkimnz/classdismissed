import type { StudentRow, World } from "@/lib/types";
import { computeStandings } from "./grades";
import { noteBalance, pendingDetention } from "./principal";
import { computeStudentStats } from "./stats";
import { classTimetable } from "./timetable";

/** Everything a student screen needs about ONE student (and their class/team), derived from the world. */
export function buildStudentView(w: World, student: StudentRow, now = Date.now()) {
  const klass = w.classes.find((c) => c.id === student.classId) ?? null;
  const standings = computeStandings(w);
  const result = klass ? (standings.find((r) => r.klass.id === klass.id) ?? null) : null;
  const stats = computeStudentStats(w).get(student.id)!;
  const rows = klass ? classTimetable(w, klass.id, now) : [];
  const marks = new Map(result?.subjects.filter((s) => s.score !== null).map((s) => [s.subject.id, { score: s.score as number, max: s.max }]));
  const noteClubs = w.clubs.filter((c) => c.awardsNote);
  // Clubs are completed, and notes earned, by the CLASS (the team walks around together).
  const doneClubIds = new Set(w.completions.filter((c) => klass && c.classId === klass.id).map((c) => c.clubId));
  const classmates = klass ? w.students.filter((s) => s.classId === klass.id) : [];
  return {
    klass,
    standings,
    result,
    stats,
    rows,
    marks,
    noteClubs,
    doneClubIds,
    classmates,
    /** The class's Teacher's Note balance: earned, spent on attempts, available. */
    notes: klass ? noteBalance(w, klass.id) : { earned: 0, spent: 0, available: 0, required: w.event.notesRequired },
    detention: pendingDetention(w, student.id),
  };
}

export type StudentView = ReturnType<typeof buildStudentView>;
