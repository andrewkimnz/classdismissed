import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loadWorld } from "@/lib/data/load-world";
import { computeStandings } from "@/lib/domain/grades";
import { noteBalance, notesToSpend, principalAccess } from "@/lib/domain/principal";
import { computeFinalStats, computeStudentStats } from "@/lib/domain/stats";
import { timetableIssues } from "@/lib/domain/timetable";
import type { World } from "@/lib/types";
import { connect, type Db } from "./client";
import { migrate } from "./migrate";
import { seed } from "./seed";

describe("schema + demo seed (in-memory Postgres)", () => {
  let conn: Db;
  let w: World;
  before(async () => {
    // Set TEST_DATABASE_URL to run the identical suite against a real Postgres (e.g. Supabase branch / local docker).
    conn = process.env.TEST_DATABASE_URL ? await connect({ url: process.env.TEST_DATABASE_URL }) : await connect({ url: "", dataDir: null });
    await migrate(conn);
    await seed(conn, { profile: "demo", demoAdmin: true });
    w = await loadWorld(conn.sql);
  });
  after(() => conn.end());

  const cls = (name: string) => w.classes.find((c) => c.name === name)!;

  it("seeds 8 classes of 6–7 students, 4 subjects, 4 periods", () => {
    assert.equal(w.classes.length, 8);
    for (const c of w.classes) {
      const n = w.students.filter((s) => s.classId === c.id).length;
      assert.ok(n >= 6 && n <= 7, `${c.name} has ${n}`);
    }
    assert.equal(w.subjects.length, 4);
    assert.equal(w.periods.length, 4);
    assert.equal(w.students.length, 52);
  });

  it("puts Andrew Kim in 2-B as KAC-042 with the brief's marks", () => {
    const andrew = w.students.find((s) => s.name === "Andrew Kim")!;
    assert.equal(andrew.studentNo, 42);
    const r = computeStandings(w).find((x) => x.klass.id === andrew.classId)!;
    assert.equal(r.klass.name, "2-B");
    assert.equal(r.raw, 63);
    assert.equal(r.originalPct, 78.75);
    assert.equal(r.originalGrade, "B+");
    assert.equal(r.currentPct, 83.75); // +5% from the RISKY break-in
    assert.equal(r.currentGrade, "A-");
  });

  it("generates a collision-free timetable", () => assert.deepEqual(timetableIssues(w), []));

  it("spends Teacher's Notes on attempts: 2-B collected 7, made 2 attempts (3 each), so only 1 is left", () => {
    const b = noteBalance(w, cls("2-B").id);
    assert.deepEqual([b.earned, b.spent, b.available, b.required], [7, 6, 1, 3]);
    const a = principalAccess(w, cls("2-B"));
    assert.equal(a.eligible, false);
    assert.equal(a.block, "notes");
    assert.equal(a.needed, 2);
  });

  it("derives which teams may go into the Principal's Office", () => {
    assert.equal(principalAccess(w, cls("1-A")).eligible, true, "4 notes, no attempts yet");
    assert.equal(principalAccess(w, cls("2-D")).eligible, true, "5 notes, no attempts yet");
    assert.equal(principalAccess(w, cls("1-D")).available, 0, "3 notes, all spent");
    assert.equal(principalAccess(w, cls("2-A")).block, "notes", "2 notes is not enough");
  });

  it("puts a caught team's whole class in detention (pending for 1-D, served for 1-B)", () => {
    const dets = (name: string) => w.detentions.filter((d) => w.students.find((s) => s.id === d.studentId)?.classId === cls(name).id && d.attemptId !== null);
    assert.equal(dets("1-D").length, w.students.filter((s) => s.classId === cls("1-D").id).length);
    assert.ok(dets("1-D").every((d) => d.status === "pending"));
    assert.ok(dets("1-B").every((d) => d.status === "served"));
  });

  it("computes the keepsake numbers for Andrew's team: 7 notes, 2 attempts, 1 break-in; his own 1 detention", () => {
    const s = computeStudentStats(w).get(w.students.find((x) => x.name === "Andrew Kim")!.id)!;
    assert.deepEqual([s.notes, s.attempts, s.successes, s.detentions], [7, 2, 1, 1]);
  });

  it("builds the final stat boards", () => {
    const boards = computeFinalStats(w);
    const highest = boards.find((b) => b.id === "highest-final")!;
    assert.equal(highest.entries[0].isWinner, true);
    assert.ok(boards.find((b) => b.id === "most-wanted")!.entries.length > 0);
    assert.ok(boards.filter((b) => b.scope === "student").every((b) => b.id === "most-wanted"), "only detention is an individual stat now");
  });

  it("prevents a class earning the same club's note twice", async () => {
    const [n] = await conn.sql<{ classId: number; clubId: number }>`select class_id, club_id from teacher_notes where club_id is not null limit 1`;
    await assert.rejects(conn.sql`insert into teacher_notes (class_id, club_id) values (${n.classId}, ${n.clubId})`);
    const [c] = await conn.sql<{ classId: number; clubId: number }>`select class_id, club_id from club_completions where revoked_at is null limit 1`;
    await assert.rejects(conn.sql`insert into club_completions (class_id, club_id) values (${c.classId}, ${c.clubId})`);
  });

  it("stores JSON as real jsonb (not a double-encoded string) on every driver", async () => {
    const rows = await conn.sql<{ t: string }>`select jsonb_typeof(rooms) as t from subjects`;
    assert.ok(rows.length > 0 && rows.every((r) => r.t === "array"));
    assert.ok(Array.isArray(w.subjects[0].rooms) && w.subjects[0].rooms.length === 2);
    const [r] = await conn.sql<{ v: number }>`select (${{ a: [1, 2, 3] }}::jsonb -> 'a' ->> 1)::int as v`;
    assert.equal(r.v, 2);
  });

  it("a team attempt: spends notes, changes the class grade, detains the whole class on a caught detention tier, and every step is reversible", async () => {
    const { applyOutcome, reverseAttemptEffects } = await import("@/lib/attempts");
    const team = cls("1-A");
    const members = w.students.filter((s) => s.classId === team.id && s.attendance !== "absent").length;
    const tiers = await conn.sql<{ id: number; name: string }>`select id, name from risk_tiers`;
    const tier = (n: string) => tiers.find((t) => t.name === n)!.id;
    const fresh = () => loadWorld(conn.sql);
    const pct = async () => computeStandings(await fresh()).find((r) => r.klass.id === team.id)!.currentPct!;
    const avail = async () => noteBalance(await fresh(), team.id).available;
    const detained = async (id: number) => (await conn.sql<{ status: string }>`select status from detentions where attempt_id = ${id}`).map((d) => d.status);
    const base = await pct();
    const notesBefore = await avail();
    assert.equal(notesBefore, 4);

    // The exec creates the team's attempt in the room.
    const [open] = await conn.sql<{ id: number }>`
      insert into principal_attempts (class_id, status, risk_tier_id, tier_name, tier_icon, success_delta, failure_delta, failure_detention, notes_spent)
      select ${team.id}::int, 'requested', t.id, t.name, t.icon, t.success_delta, t.failure_delta, t.failure_detention, ${notesToSpend(noteBalance(await fresh(), team.id))}::int
      from risk_tiers t where t.name = 'RISKY' returning id`;

    await conn.tx((sql) => applyOutcome(sql, { attemptId: open.id, outcome: "success", tierId: tier("RISKY"), actorId: 1 }));
    assert.equal(await pct(), base + 5, "RISKY success = +5");
    assert.equal(await avail(), notesBefore - 3, "the attempt SPENDS 3 notes (this is what used to stay at 4/3)");

    // Entered wrong: it was a failure on RECKLESS. One correction fixes everything, and the notes stay spent once.
    await conn.tx((sql) => applyOutcome(sql, { attemptId: open.id, outcome: "failure", tierId: tier("RECKLESS"), actorId: 1 }));
    assert.equal(await pct(), base - 5, "old +5 reversed, RECKLESS failure = -5");
    assert.equal(await avail(), notesBefore - 3, "correcting must not spend notes twice");
    const pending = await detained(open.id);
    assert.equal(pending.length, members, "the WHOLE class goes to detention");
    assert.ok(pending.every((x) => x === "pending"));

    // Flip back to success: grade change and every detention are undone.
    await conn.tx((sql) => applyOutcome(sql, { attemptId: open.id, outcome: "success", tierId: tier("SAFE"), actorId: 1 }));
    assert.equal(await pct(), base + 2);
    assert.ok((await detained(open.id)).every((x) => x === "cancelled"));

    // Void: the class grade AND the notes come back.
    await conn.tx(async (sql) => {
      await reverseAttemptEffects(sql, open.id, 1, "test");
      await sql`update principal_attempts set status = 'voided' where id = ${open.id}`;
    });
    assert.equal(await pct(), base, "voiding restores the class grade exactly");
    assert.equal(await avail(), notesBefore, "voiding refunds the spent notes");
  });

  it("never lets a class go into debt: an override attempt spends only the notes it has (the '0/3 after earning 2 notes' bug)", async () => {
    const team = cls("2-A"); // demo: 2 notes earned, needs 3
    const before = noteBalance(await loadWorld(conn.sql), team.id);
    assert.deepEqual([before.earned, before.available, before.required], [2, 2, 3]);
    assert.equal(notesToSpend(before), 2, "an override spends what they have, not the full 3");

    const [att] = await conn.sql<{ id: number }>`insert into principal_attempts (class_id, status, tier_name, notes_spent) values (${team.id}, 'resolved', 'SAFE', ${notesToSpend(before)}) returning id`;
    const after = noteBalance(await loadWorld(conn.sql), team.id);
    assert.deepEqual([after.spent, after.available], [2, 0]);

    // notes earned AFTER the override count in full. This used to stay at 0 because of a phantom debt.
    const have = new Set((await conn.sql<{ clubId: number }>`select club_id from teacher_notes where class_id = ${team.id} and revoked_at is null`).map((r) => r.clubId));
    const free = (await conn.sql<{ id: number }>`select id from clubs where awards_note order by id`).filter((c) => !have.has(c.id)).slice(0, 2);
    const added: number[] = [];
    for (const c of free) added.push((await conn.sql<{ id: number }>`insert into teacher_notes (class_id, club_id) values (${team.id}, ${c.id}) returning id`)[0].id);
    const later = noteBalance(await loadWorld(conn.sql), team.id);
    assert.deepEqual([later.earned, later.available], [4, 2], "2 new notes = 2 available");

    // leave the shared demo data exactly as we found it
    for (const id of added) await conn.sql`delete from teacher_notes where id = ${id}`;
    await conn.sql`delete from principal_attempts where id = ${att.id}`;
  });

  it("keeps earlier balances when 'notes per attempt' is changed later", async () => {
    const team = cls("2-B"); // 7 earned, 2 attempts made at 3 each
    const original = noteBalance(await loadWorld(conn.sql), team.id);
    assert.deepEqual([original.earned, original.spent, original.available], [7, 6, 1]);
    await conn.sql`update events set notes_required = 2 where id = 1`;
    const changed = noteBalance(await loadWorld(conn.sql), team.id);
    assert.deepEqual([changed.spent, changed.available, changed.required], [6, 1, 2], "history is not rewritten; only future attempts cost 2");
    await conn.sql`update events set notes_required = 3 where id = 1`;
  });

  it("ticks the live heartbeat on every change", async () => {
    const [{ rev: before }] = await conn.sql<{ rev: number }>`select rev from live_state`;
    await conn.sql`update events set scoring_locked = true where id = 1`;
    const [{ rev: after }] = await conn.sql<{ rev: number }>`select rev from live_state`;
    assert.ok(after > before);
  });
});

describe("staff authentication primitives", () => {
  it("verifies the seeded demo admin's password hash and rejects a wrong one", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
    const { DEMO_ADMIN } = await import("./seed");
    const hash = await hashPassword(DEMO_ADMIN.password);
    assert.ok(hash.startsWith("scrypt$"));
    assert.equal(await verifyPassword(DEMO_ADMIN.password, hash), true);
    assert.equal(await verifyPassword("wrong-password", hash), false);
    assert.equal(await verifyPassword("x", "not-a-hash"), false);
  });
  it("rejects tampered or expired session cookies", async () => {
    const { signSession, verifySession } = await import("@/lib/auth/session");
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = signSession({ t: "a", id: 1, exp });
    assert.equal(verifySession(token, "a")?.id, 1);
    assert.equal(verifySession(token, "s"), null, "an admin cookie must not work as a student cookie");
    // Flip the FIRST signature character (the last one has spare padding bits, so changing it can decode to identical bytes).
    const [body, sig] = token.split(".");
    assert.equal(verifySession(`${body}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`, "a"), null);
    // Tampered payload with the original signature must fail too (e.g. trying to become admin id 2).
    const forged = Buffer.from(JSON.stringify({ t: "a", id: 2, exp })).toString("base64url");
    assert.equal(verifySession(`${forged}.${sig}`, "a"), null);
    assert.equal(verifySession(signSession({ t: "a", id: 1, exp: 1 }), "a"), null);
    assert.equal(verifySession(undefined, "a"), null);
  });
});

describe("explicit seeding is respected by the zero-config boot", () => {
  it("marks the database as seeded so an auto-boot never overwrites a chosen profile", async () => {
    const c = await connect({ url: "", dataDir: null });
    await migrate(c);
    await seed(c, { profile: "fresh" });
    const marker = await c.sql`select 1 from _kac_migrations where name = 'auto-seed:demo'`;
    assert.equal(marker.length, 1);
    const { prepareEmbedded } = await import("./embedded");
    await prepareEmbedded(c);
    const [{ n }] = await c.sql<{ n: number }>`select count(*)::int as n from class_subject_scores`;
    assert.equal(n, 0, "the fresh profile (no scores) must survive prepareEmbedded");
    await c.end();
  });
});

describe("start the event fresh", () => {
  it("clears everything that happened and keeps everything that was set up beforehand", async () => {
    const { countEventActivity, resetEventData } = await import("@/lib/reset");
    const c = process.env.TEST_DATABASE_URL ? await connect({ url: process.env.TEST_DATABASE_URL }) : await connect({ url: "", dataDir: null });
    await migrate(c);
    await seed(c, { profile: "demo" });

    // add the kinds of things an exec does on the night, on top of the demo activity
    const [stu] = await c.sql<{ id: number; classId: number }>`select id, class_id from students where name = 'Andrew Kim'`;
    await c.sql`insert into photos (kind, student_id, url, storage_path) values ('student_id', ${stu.id}, '/uploads/x.jpg', 'x.jpg')`;
    await c.sql`insert into photos (kind, class_id, url, storage_path) values ('class_team', ${stu.classId}, '/uploads/t.jpg', 't.jpg')`;
    await c.sql`update students set custom_award = 'BEST FORGER' where id = ${stu.id}`;
    await c.sql`update events set scoring_locked = true, current_period = 3 where id = 1`;

    const setup = async () => (await c.sql<Record<string, number>>`
      select (select count(*)::int from classes) as classes, (select count(*)::int from students) as students,
             (select count(*)::int from clubs) as clubs, (select count(*)::int from subjects) as subjects,
             (select count(*)::int from periods) as periods, (select count(*)::int from rotations) as rotations,
             (select count(*)::int from risk_tiers) as tiers, (select count(*)::int from grade_boundaries) as boundaries,
             (select count(*)::int from photos where is_current) as photos, (select count(*)::int from admins) as admins,
             (select count(distinct login_code)::int from students) as codes`)[0];
    const kept = await setup();
    const [names0] = await c.sql<{ n: string }>`select string_agg(name, ',' order by id) as n from classes`;
    const [stuNames0] = await c.sql<{ n: string }>`select string_agg(name || student_no || class_id, ',' order by id) as n from students`;

    const before = await countEventActivity(c.sql);
    assert.ok(before.scores > 0 && before.notes > 0 && before.attempts > 0 && before.detentions > 0 && before.checkedIn > 0, "there is something to clear");
    const cleared = await c.tx((sql) => resetEventData(sql));
    assert.deepEqual(cleared, before, "reports exactly what it cleared");

    // everything that happened is gone…
    assert.deepEqual(await countEventActivity(c.sql), { scores: 0, notes: 0, clubCompletions: 0, attempts: 0, gradeChanges: 0, detentions: 0, checkedIn: 0 });
    const [ev] = await c.sql<{ phase: string; currentPeriod: number; scoringLocked: boolean }>`select phase, current_period, scoring_locked from events`;
    assert.deepEqual([ev.phase, ev.currentPeriod, ev.scoringLocked], ["school_day", 0, false]);
    const [award] = await c.sql<{ n: number }>`select count(*)::int as n from students where custom_award is not null`;
    assert.equal(award.n, 0);

    // …and everything set up beforehand is exactly as it was (names, numbers, classes, codes, photos)
    assert.deepEqual(await setup(), kept);
    assert.equal((await c.sql<{ n: string }>`select string_agg(name, ',' order by id) as n from classes`)[0].n, names0.n);
    assert.equal((await c.sql<{ n: string }>`select string_agg(name || student_no || class_id, ',' order by id) as n from students`)[0].n, stuNames0.n);

    // the fresh event behaves like a new one: no grade until marked, nobody can go into the Principal's Office yet
    const w = await loadWorld(c.sql);
    assert.ok(computeStandings(w).every((r) => r.scoredCount === 0 && r.currentPct === null));
    assert.ok(w.classes.every((k) => noteBalance(w, k.id).earned === 0));
    await c.end();
  });
});

describe("migration 0005 repairs attempts that were recorded before notes were earned", () => {
  it("gives each attempt only the notes the class had at the time, so later notes are fully usable", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const c = process.env.TEST_DATABASE_URL ? await connect({ url: process.env.TEST_DATABASE_URL }) : await connect({ url: "", dataDir: null });
    await migrate(c);
    await seed(c, { profile: "fresh" });
    const [k] = await c.sql<{ id: number }>`select id from classes order by id limit 1`;
    const clubs = await c.sql<{ id: number }>`select id from clubs where awards_note order by id limit 5`;
    // timeline: attempt A (no notes yet) → 2 notes → attempt B (only 2 notes: override) → 3 more notes → attempt C (full price)
    const at = (mins: number) => new Date(Date.UTC(2026, 9, 2, 6, mins)).toISOString();
    const attempt = async (mins: number) => (await c.sql<{ id: number }>`insert into principal_attempts (class_id, status, tier_name, created_at) values (${k.id}, 'resolved', 'X', ${at(mins)}::timestamptz) returning id`)[0].id;
    const note = (clubId: number, mins: number) => c.sql`insert into teacher_notes (class_id, club_id, created_at) values (${k.id}, ${clubId}, ${at(mins)}::timestamptz)`;
    const a = await attempt(0);
    await note(clubs[0].id, 1);
    await note(clubs[1].id, 2);
    const b = await attempt(3);
    await note(clubs[2].id, 4);
    await note(clubs[3].id, 5);
    await note(clubs[4].id, 6);
    const cc = await attempt(7);

    // run the repair exactly as shipped (the DO block in the migration file) over unrepaired data
    const sql0005 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/0005_note_spend_snapshot.sql"), "utf8");
    await c.sql`update principal_attempts set notes_spent = 0`;
    await c.exec(sql0005.slice(sql0005.indexOf("do $$")));

    const spent = Object.fromEntries((await c.sql<{ id: number; notesSpent: number }>`select id, notes_spent from principal_attempts`).map((r) => [r.id, r.notesSpent]));
    assert.equal(spent[a], 0, "made with 0 notes → spent 0");
    assert.equal(spent[b], 2, "made with 2 notes (needs 3) → spent only 2");
    assert.equal(spent[cc], 3, "made with 3 notes available → full price");
    const bal = noteBalance(await loadWorld(c.sql), k.id);
    assert.deepEqual([bal.earned, bal.spent, bal.available], [5, 5, 0]);
    await c.end();
  });
});
