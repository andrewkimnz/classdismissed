import { generateLoginCode } from "@/lib/auth/codes";
import { hashPassword } from "@/lib/auth/password";
import { generateTimetable } from "@/lib/domain/timetable";
import { zonedToUtc } from "@/lib/domain/time";
import type { ClassRow, PeriodRow, SubjectRow } from "@/lib/types";
import type { Db } from "./client";

/**
 * Seed / reset the event.
 *
 *  demo   Everything: roster, timetable, scores, phase = After School, plus
 *         sample Teacher's Notes, Principal's Office attempts and detentions.
 *  fresh  Same roster + config but a clean School Day: no scores, notes, attempts.
 *  blank  Config only (classes, subjects, clubs, tiers, grades). No students.
 *
 * Accounts are never deleted. The demo admin is only created when asked for.
 */
export type SeedProfile = "demo" | "fresh" | "blank";
export const DEMO_ADMIN = { username: "admin", password: "classdismissed", name: "Demo Exec" };
export const DEMO_STUDENT_CODE = "KIM042";

const EVENT_DATE = "2026-10-02";
const TZ = "Pacific/Auckland";

// ── deterministic RNG so the demo is the same every time ───────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLASSES = [
  { name: "1-A", color: "#E8628C" },
  { name: "1-B", color: "#F59E0B" },
  { name: "1-C", color: "#2FA36B" },
  { name: "1-D", color: "#2E86DE" },
  { name: "2-A", color: "#8E5CF0" },
  { name: "2-B", color: "#E5484D" },
  { name: "2-C", color: "#14B8C4" },
  { name: "2-D", color: "#84CC16" },
];

const ROSTER: string[][] = [
  ["Emily Tanaka", "Jason Nguyen", "Sophie Lim", "Kenji Watanabe", "Priya Sharma", "Daniel Choi", "Mei Chen"],
  ["Hannah Park", "Ryan Wong", "Yuki Sato", "Aiden Tran", "Chloe Zhang", "Minjun Seo", "Olivia Patel"],
  ["Jamie Yoon", "Ethan Liu", "Sakura Ito", "Lucas Tan", "Grace Huang", "Haruto Nakamura", "Aroha Smith"],
  ["Isabella Cho", "Nathan Ong", "Rina Kobayashi", "Ben Kwon", "Zoe Wu", "Arjun Mehta", "Tama Walker"],
  ["Ji-woo Han", "Callum Lau", "Hana Yamamoto", "Kevin Do", "Ella Xu", "Samuel Ahn"],
  ["Andrew Kim", "Rachel Jung", "Tomoko Hayashi", "Vincent Cheng", "Nina Bui", "Kai Anderson"],
  ["Maya Krishnan", "Joon Baek", "Ava Chua", "Leo Fujita", "Tessa Li", "Dylan Pham"],
  ["Sora Mori", "Alex Yang", "Bella Kang", "Oliver Ng", "Suzy Moon", "Ravi Singh"],
];

// History, Social Studies, Maths, Geography (each out of 20)
const DEMO_SCORES: number[][] = [
  [17, 15, 14, 16], // 1-A 77.5
  [12, 16, 15, 13], // 1-B 70
  [18, 17, 16, 17], // 1-C 85
  [10, 13, 12, 14], // 1-D 61.25
  [15, 18, 17, 14], // 2-A 80
  [16, 14, 18, 15], // 2-B 63/80 = 78.75 → B+
  [14, 11, 13, 12], // 2-C 62.5
  [16, 16, 15, 19], // 2-D 82.5
];

const SUBJECTS = [
  {
    name: "HISTORY", icon: "📜", color: "#B45F3C", tagline: "Try not to get caught.",
    description: "The teacher delivers an absurdly serious lesson. Your class has one secret mission.",
    activity: "Secretly eat chips without the teacher noticing. Points for stealth, style and crunch control.",
    rooms: ["201-315", "201-323"],
  },
  {
    name: "SOCIAL STUDIES", icon: "🌏", color: "#2E86DE", tagline: "General knowledge, no phones.",
    description: "A pub quiz wearing a school uniform.",
    activity: "General trivia. Confer as a class, one answer per question.",
    rooms: ["201-316", "201-324"],
  },
  {
    name: "MATHS", icon: "➗", color: "#8E5CF0", tagline: "Paper. Lots of paper.",
    description: "Numeracy, but make it a craft project.",
    activity: "Paper planes, paper basketball, a times-table sheet and bottle-cap flicking to the table edge.",
    rooms: ["201-317", "201-325"],
  },
  {
    name: "GEOGRAPHY", icon: "🗺️", color: "#2FA36B", tagline: "Where in the world?",
    description: "Flags, landmarks and countries. Passport not required.",
    activity: "Name the flags, identify the landmarks, place the countries.",
    rooms: ["201-318", "201-326"],
  },
];

const CLUBS = [
  { name: "Photography Club", icon: "📸", color: "#F8B4C8", room: "201-315", awards: false, open: true,
    description: "Graduation photos, Polaroids, team photos and photos with the execs. KAC photo frame and props provided.",
    instructions: "Get a graduation photo taken with your class or an exec. Just for the memories: no Teacher's Note here." },
  { name: "Art Club", icon: "🎨", color: "#FFD54A", room: "201-316", awards: true, open: true,
    description: "The yearbook wall! Write a message, draw something, and contribute to the KAC yearbook.",
    instructions: "Leave a message or drawing on the yearbook wall, then show an exec to collect your Teacher's Note." },
  { name: "PE Club", icon: "🏃", color: "#7BD3A0", room: "201-317", awards: true, open: true,
    description: "Egg-and-spoon, an obstacle course and other physical challenges.",
    instructions: "Complete the egg-and-spoon race without dropping your egg. Cracked egg = go again." },
  { name: "Language Club", icon: "🗣️", color: "#9CC8FF", room: "201-318", awards: true, open: true,
    description: "How many ways can you say hello?",
    instructions: "Write 'hi' in 20 different languages. Bring your list to an exec." },
  { name: "Music Club", icon: "🎵", color: "#C9B3FF", room: "201-323", awards: true, open: true,
    description: "Song jumble: the lyrics are scrambled. Can you unscramble them?",
    instructions: "Unscramble the song titles. All correct = Teacher's Note." },
  { name: "Puzzle Club", icon: "🧩", color: "#FFB88C", room: "201-324", awards: true, open: true,
    description: "Codes, ciphers and clues. Decode the message.",
    instructions: "Decode the puzzle and tell an exec the hidden phrase." },
  { name: "Debate Club", icon: "🎤", color: "#FF9AA2", room: "201-325", awards: true, open: true,
    description: "Short debates on important matters, like whether a hot dog is a sandwich.",
    instructions: "Take part in one debate round (either side)." },
  { name: "Drama Club", icon: "🎭", color: "#FFC6E0", room: "201-326", awards: true, open: false,
    description: "Recreate famous scenes and play charades.",
    instructions: "Act out your scene so your team can guess it." },
];

const TIERS = [
  { name: "SAFE", icon: "🍀", description: "A cautious peek at the laptop.", s: 2, f: 0, d: false },
  { name: "RISKY", icon: "🔥", description: "You know where the Principal keeps the password.", s: 5, f: -2, d: false },
  { name: "RECKLESS", icon: "💀", description: "All-in. If you're caught, you're in detention.", s: 10, f: -5, d: true },
];

const BOUNDARIES: [string, number][] = [
  ["A+", 90], ["A", 85], ["A-", 80], ["B+", 75], ["B", 70], ["B-", 65],
  ["C+", 60], ["C", 55], ["C-", 50], ["D", 40], ["F", 0],
];

export interface SeedSummary {
  profile: SeedProfile;
  classes: number;
  students: number;
  demoAdmin: boolean;
}

export async function seed(conn: Db, opts: { profile: SeedProfile; demoAdmin?: boolean }): Promise<SeedSummary> {
  const { profile } = opts;
  const rng = mulberry32(2026);

  await conn.tx(async (sql) => {
    // ── wipe (accounts survive) ──────────────────────────────────────────
    await sql`truncate table audit_log, photos, detentions, grade_modifications, principal_attempts, risk_tiers,
      teacher_notes, club_completions, clubs, grade_boundaries, class_subject_scores, rotations, periods,
      subjects, students, classes restart identity cascade`;
    await sql`delete from events`;
    await sql`insert into events (id, event_date, timezone, phase, current_period)
      values (1, ${EVENT_DATE}::date, ${TZ}, ${profile === "demo" ? "after_school" : "school_day"}, ${profile === "demo" ? 5 : 0})`;
    // buzzer_state's singleton row (id = 1) is a foreign-key child of students/periods, so the CASCADE
    // above truncates it too: put it back, freshly reset, every time.
    await sql`insert into buzzer_state (id) values (1) on conflict (id) do update set
      question_number = 0, buzzed_student_id = null, buzzed_at = null, result = null`;

    // ── configuration ────────────────────────────────────────────────────
    for (const [grade, min] of BOUNDARIES) {
      await sql`insert into grade_boundaries (grade, min_percent) values (${grade}, ${min})`;
    }
    const classRows: ClassRow[] = [];
    for (const [i, c] of CLASSES.entries()) {
      const [row] = await sql<ClassRow>`
        insert into classes (name, color, sort_order) values (${c.name}, ${c.color}, ${i}) returning *`;
      classRows.push(row);
    }
    const subjectRows: SubjectRow[] = [];
    for (const [i, s] of SUBJECTS.entries()) {
      const [row] = await sql<SubjectRow>`
        insert into subjects (name, tagline, description, activity, icon, color, max_score, rooms, sort_order, is_maths_challenge, is_buzzer_challenge)
        values (${s.name}, ${s.tagline}, ${s.description}, ${s.activity}, ${s.icon}, ${s.color}, 20, ${s.rooms}::jsonb, ${i}, ${/^maths?$/i.test(s.name)}, ${/^social\s*studies$/i.test(s.name)}) returning *`;
      subjectRows.push(row);
    }
    const periodRows: PeriodRow[] = [];
    for (let n = 1; n <= 4; n++) {
      const mins = 18 * 60 + 30 + (n - 1) * 10;
      const hhmm = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      const start = zonedToUtc(EVENT_DATE, hhmm, TZ);
      const end = new Date(start.getTime() + 10 * 60_000);
      const [row] = await sql<PeriodRow>`
        insert into periods (number, starts_at, ends_at) values (${n}, ${start}, ${end}) returning *`;
      periodRows.push(row);
    }
    for (const cell of generateTimetable(classRows, periodRows, subjectRows)) {
      await sql`insert into rotations (period_id, class_id, subject_id, room)
        values (${cell.periodId}, ${cell.classId}, ${cell.subjectId}, ${cell.room})`;
    }
    const clubIds: number[] = [];
    for (const [i, c] of CLUBS.entries()) {
      const [row] = await sql<{ id: number }>`
        insert into clubs (name, icon, color, description, instructions, room, is_open, awards_note, sort_order)
        values (${c.name}, ${c.icon}, ${c.color}, ${c.description}, ${c.instructions}, ${c.room}, ${c.open}, ${c.awards}, ${i})
        returning id`;
      clubIds.push(row.id);
    }
    const tierIds: number[] = [];
    for (const [i, t] of TIERS.entries()) {
      const [row] = await sql<{ id: number }>`
        insert into risk_tiers (name, icon, description, success_delta, failure_delta, failure_detention, sort_order)
        values (${t.name}, ${t.icon}, ${t.description}, ${t.s}, ${t.f}, ${t.d}, ${i}) returning id`;
      tierIds.push(row.id);
    }

    if (profile === "blank") return;

    // ── roster ───────────────────────────────────────────────────────────
    // Student numbers are a seeded shuffle, with Andrew pinned to KAC-042.
    const total = ROSTER.flat().length;
    const numbers = Array.from({ length: total }, (_, i) => i + 1);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    const andrewSlot = ROSTER.flat().indexOf("Andrew Kim");
    const at42 = numbers.indexOf(42);
    [numbers[andrewSlot], numbers[at42]] = [numbers[at42], numbers[andrewSlot]];

    const studentIds = new Map<string, number>(); // name → id
    const usedCodes = new Set<string>([DEMO_STUDENT_CODE]);
    let slot = 0;
    for (const [ci, names] of ROSTER.entries()) {
      for (const name of names) {
        let code = name === "Andrew Kim" ? DEMO_STUDENT_CODE : generateLoginCode();
        while (usedCodes.has(code) && name !== "Andrew Kim") code = generateLoginCode();
        usedCodes.add(code);
        const late = profile === "demo" && ["Sakura Ito", "Rina Kobayashi", "Bella Kang"].includes(name);
        const absent = profile === "demo" && name === "Suzy Moon";
        const attendance = profile === "demo" ? (absent ? "absent" : late ? "expected" : "present") : "expected";
        const [row] = await sql<{ id: number }>`
          insert into students (student_no, name, class_id, login_code, attendance, checked_in_at)
          values (${numbers[slot++]}, ${name}, ${classRows[ci].id}, ${code}, ${attendance},
                  ${attendance === "present" ? new Date() : null})
          returning id`;
        studentIds.set(name, row.id);
      }
    }

    if (profile === "fresh") return;

    // ── demo activity (Phase 1 results) ──────────────────────────────────
    for (const [ci, marks] of DEMO_SCORES.entries()) {
      for (const [si, mark] of marks.entries()) {
        await sql`insert into class_subject_scores (class_id, subject_id, score)
          values (${classRows[ci].id}, ${subjectRows[si].id}, ${mark})`;
      }
    }

    // ── demo activity (Phase 2): everything is done by CLASSES (teams) ───
    const classNo = (name: string) => classRows[CLASSES.findIndex((c) => c.name === name)].id;
    const clubNo = (name: string) => clubIds[CLUBS.findIndex((c) => c.name === name)];

    // Which clubs each class has completed. Every awarding club gives the class one Teacher's Note.
    const completed: Record<string, string[]> = {
      "1-A": ["Art Club", "PE Club", "Music Club", "Puzzle Club"],
      "1-B": ["Art Club", "PE Club", "Puzzle Club", "Language Club", "Music Club", "Debate Club"],
      "1-C": ["PE Club", "Art Club", "Language Club", "Music Club"],
      "1-D": ["Puzzle Club", "Music Club", "Debate Club"],
      "2-A": ["Art Club", "PE Club"],
      "2-B": ["Art Club", "PE Club", "Language Club", "Music Club", "Puzzle Club", "Debate Club", "Photography Club"],
      "2-C": ["PE Club", "Language Club", "Puzzle Club"],
      "2-D": ["Art Club", "PE Club", "Puzzle Club", "Debate Club", "Language Club", "Photography Club"],
    };
    for (const [cls, clubs] of Object.entries(completed)) {
      for (const clubName of clubs) {
        const club = CLUBS.find((c) => c.name === clubName)!;
        const [comp] = await sql<{ id: number }>`
          insert into club_completions (class_id, club_id) values (${classNo(cls)}, ${clubNo(clubName)}) returning id`;
        if (club.awards) {
          await sql`insert into teacher_notes (class_id, club_id, completion_id) values (${classNo(cls)}, ${clubNo(clubName)}, ${comp.id})`;
        }
      }
    }
    await sql`insert into teacher_notes (class_id, reason) values (${classNo("2-B")}, 'Helped set up the yearbook wall')`;

    const tier = (name: string) => {
      const i = TIERS.findIndex((t) => t.name === name);
      return { id: tierIds[i], ...TIERS[i] };
    };

    /** One Principal's Office attempt by a whole class. A caught result on a detention tier sends everyone who is here. */
    async function attempt(cls: string, tierName: string, outcome: "success" | "failure", notes = "") {
      const t = tier(tierName);
      const cid = classNo(cls);
      const delta = outcome === "success" ? t.s : t.f;
      const [a] = await sql<{ id: number }>`
        insert into principal_attempts (class_id, status, risk_tier_id, tier_name, tier_icon,
          success_delta, failure_delta, failure_detention, notes_spent, outcome, delta_applied, notes, resolved_at)
        values (${cid}, 'resolved', ${t.id}, ${t.name}, ${t.icon},
          ${t.s}, ${t.f}, ${t.d}, 3, ${outcome}, ${delta}, ${notes}, now())
        returning id`;
      if (delta) {
        await sql`insert into grade_modifications (class_id, attempt_id, kind, delta_percent, reason)
          values (${cid}, ${a.id}, 'principal_attempt', ${delta}, ${`${t.name} attempt: ${outcome}`})`;
      }
      if (outcome === "failure" && t.d) {
        await sql`insert into detentions (student_id, attempt_id, reason, room)
          select id, ${a.id}::int, 'Caught attempting to alter school records', '201-320' from students where class_id = ${cid} and attendance <> 'absent'`;
      }
      return a.id;
    }

    // 2-B is the demo class: 7 notes collected, 2 attempts (6 spent) → only 1 left.
    await attempt("2-B", "RISKY", "success", "Smooth. Nobody saw a thing.");
    await attempt("2-B", "SAFE", "failure", "Tripped over the wastepaper bin.");
    await attempt("1-C", "RECKLESS", "success", "Legendary.");
    await attempt("2-C", "SAFE", "success");
    await attempt("1-B", "RISKY", "failure");
    const oneB = await attempt("1-B", "RECKLESS", "failure", "Knocked over the Principal's plant.");
    await attempt("1-D", "RECKLESS", "failure", "Sneezed in the vent."); // 1-D is in detention right now

    // 1-B has already served their team detention; 1-D's is still pending.
    await sql`update detentions set status = 'served', released_at = now() where attempt_id = ${oneB}`;
    // Andrew also picked up an individual detention earlier, already served.
    await sql`insert into detentions (student_id, reason, room, status, released_at)
      values (${studentIds.get("Andrew Kim")!}, 'Caught eating chips during History', '201-320', 'served', now())`;

    const [demoAdmin] = await sql<{ id: number }>`select id from admins order by id limit 1`;
    await sql`insert into audit_log (admin_id, admin_name, action, summary)
      values (${demoAdmin?.id ?? null}, 'system', 'seed.demo', 'Loaded demo data (52 students, 8 classes).')`;
  });

  if (opts.demoAdmin) {
    const hash = await hashPassword(DEMO_ADMIN.password);
    // Older demo databases have the demo account under its former email-style name: keep it, just rename it.
    await conn.sql`update admins set email = ${DEMO_ADMIN.username}::text where lower(email) = 'admin@kac.test'
      and not exists (select 1 from admins where lower(email) = lower(${DEMO_ADMIN.username}::text))`;
    await conn.sql`
      insert into admins (email, name, role, password_hash)
      select ${DEMO_ADMIN.username}::text, ${DEMO_ADMIN.name}::text, 'admin', ${hash}::text
      where not exists (select 1 from admins where lower(email) = lower(${DEMO_ADMIN.username}::text))`;
  }

  // Record that this database was seeded on purpose, so the zero-config dev boot
  // (which auto-loads demo data into an *empty* embedded DB) never overwrites it.
  await conn.exec("create table if not exists _kac_migrations (name text primary key, applied_at timestamptz not null default now())");
  await conn.sql`insert into _kac_migrations (name) values ('auto-seed:demo') on conflict (name) do nothing`;

  return { profile, classes: CLASSES.length, students: profile === "blank" ? 0 : ROSTER.flat().length, demoAdmin: Boolean(opts.demoAdmin) };
}
