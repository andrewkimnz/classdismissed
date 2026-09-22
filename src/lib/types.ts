/** Row types. Column names are camelCased by the db layer. */

export type Phase = "school_day" | "after_school" | "event_complete";
export type LeaderboardMode = "exact" | "grades" | "hidden";
export type TimetableMode = "manual" | "clock";
export type AdminRole = "admin" | "teacher";

export interface EventRow {
  id: 1;
  name: string;
  tagline: string;
  eventDate: string;
  timezone: string;
  venue: string;
  assemblyPoint: string;
  phase: Phase;
  phaseChangedAt: Date;
  scoringLocked: boolean;
  leaderboardMode: LeaderboardMode;
  timetableMode: TimetableMode;
  currentPeriod: number;
  notesRequired: number;
  principalRoom: string;
  detentionRoom: string;
  detentionInstructions: string;
}

export interface AdminRow {
  id: number;
  /** Stored in the `email` column (kept under that name so no database migration was needed); it is a plain username. */
  username: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface ClassRow {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  teamPhotoUrl: string | null;
}

export interface StudentRow {
  id: number;
  studentNo: number;
  name: string;
  classId: number | null;
  attendance: "expected" | "present" | "absent";
  checkedInAt: Date | null;
  customAward: string | null;
  notes: string;
  photoUrl: string | null;
  finalPhotoUrl: string | null;
  createdAt: Date;
}

export interface SubjectRow {
  id: number;
  name: string;
  tagline: string;
  description: string;
  activity: string;
  icon: string;
  color: string;
  maxScore: number;
  rooms: string[];
  sortOrder: number;
  active: boolean;
  /** Whichever subject this is on, that's when the Maths toss challenge runs. Normally just MATHS. */
  isMathsChallenge: boolean;
  /** Whichever subject this is on, that's when the Buzzer round runs. Normally just SOCIAL STUDIES. */
  isBuzzerChallenge: boolean;
}

export interface PeriodRow {
  id: number;
  number: number;
  startsAt: Date;
  endsAt: Date;
}

export interface RotationRow {
  id: number;
  periodId: number;
  classId: number;
  subjectId: number;
  room: string;
}

/**
 * A student's Maths-toss-challenge progress for one period: one row, reused for every toss that
 * period. Server-side only: `question`/`answer` must never be sent to a browser for anyone but the
 * student it belongs to, and `answer` never at all.
 */
export interface MathChallengeRow {
  id: number;
  studentId: number;
  periodId: number;
  streak: number;
  attempts: number;
  /** Toss windows completed this period. */
  tosses: number;
  question: string | null;
  answer: number | null;
  status: "playing" | "ready";
  /** When the current "go toss it" window opened; null while playing. */
  wonAt: Date | null;
  /** When a window last ended, automatically or because an exec cleared it early. */
  lastTossedAt: Date | null;
  lastTossedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoreRow {
  id: number;
  classId: number;
  subjectId: number;
  score: number;
  updatedAt: Date;
}

export interface BoundaryRow {
  id: number;
  grade: string;
  minPercent: number;
}

export interface ClubRow {
  id: number;
  name: string;
  icon: string;
  color: string;
  imageUrl: string | null;
  description: string;
  instructions: string;
  room: string;
  isOpen: boolean;
  awardsNote: boolean;
  sortOrder: number;
  archivedAt: Date | null;
}

/** A class (team) finishing a club. */
export interface CompletionRow {
  id: number;
  classId: number;
  clubId: number;
  awardedBy: number | null;
  createdAt: Date;
}

/** A Teacher's Note earned by a class (team). */
export interface NoteRow {
  id: number;
  classId: number;
  clubId: number | null;
  completionId: number | null;
  reason: string;
  issuedBy: number | null;
  createdAt: Date;
}

export interface RiskTierRow {
  id: number;
  name: string;
  description: string;
  successDelta: number;
  failureDelta: number;
  failureDetention: boolean;
  icon: string;
  enabled: boolean;
  sortOrder: number;
}

export type AttemptStatus = "requested" | "resolved" | "cancelled" | "voided";

/** A Principal's Office attempt made by a class (team). */
export interface AttemptRow {
  id: number;
  classId: number;
  status: AttemptStatus;
  riskTierId: number | null;
  tierName: string;
  tierIcon: string;
  successDelta: number;
  failureDelta: number;
  failureDetention: boolean;
  /** Teacher's Notes this attempt used up (recorded when it was made). */
  notesSpent: number;
  outcome: "success" | "failure" | null;
  deltaApplied: number | null;
  notes: string;
  requestedAt: Date;
  resolvedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
}

export interface ModificationRow {
  id: number;
  classId: number;
  attemptId: number | null;
  kind: "principal_attempt" | "manual";
  deltaPercent: number;
  reason: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface DetentionRow {
  id: number;
  studentId: number;
  attemptId: number | null;
  reason: string;
  room: string;
  status: "pending" | "served" | "cancelled";
  enteredAt: Date;
  releasedAt: Date | null;
}

export interface AuditRow {
  id: number;
  at: Date;
  adminId: number | null;
  adminName: string;
  action: string;
  entity: string;
  entityId: number | null;
  summary: string;
  data: unknown;
}

/** Everything the app needs to render any screen, loaded in one go. */
export interface World {
  event: EventRow;
  classes: ClassRow[];
  students: StudentRow[];
  subjects: SubjectRow[];
  periods: PeriodRow[];
  rotations: RotationRow[];
  scores: ScoreRow[];
  boundaries: BoundaryRow[];
  clubs: ClubRow[]; // not archived
  completions: CompletionRow[]; // active only
  notes: NoteRow[]; // active only
  attempts: AttemptRow[]; // every status
  mods: ModificationRow[]; // active only
  detentions: DetentionRow[]; // every status
  tiers: RiskTierRow[];
}
