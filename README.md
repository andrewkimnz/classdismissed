# KAC Academy: *Class Dismissed*

The live event app for **KAC Presents: Class Dismissed** (Friday 2 October 2026, University of Auckland).
A mobile-first "school intranet" that every attendee opens on their phone, plus a staff room for the
execs who run the night.

Two phases, one product:

| | **School Day** | **After School** | **Event Complete** |
|---|---|---|---|
| Students | ID card, per-class timetable ("right now" / "your next class"), subject marks | Clubs, their class's Teacher's Notes, detention | Keepsake: original → final grade, stats, special award |
| Execs | Ring the rotation bell, enter class scores | Award notes to classes, record team Principal's Office runs, serve detentions | Final stats, awards |

Flip the phase from the admin panel and every student phone changes within seconds (a full-screen
**CLASS DISMISSED** moment fires on the way).

---

## Quick start (no accounts needed)

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables the app runs on an **embedded Postgres (PGlite)** stored in `.data/`, and
loads demo data on first boot: 8 classes, 52 students, timetable, scores, clubs, notes, detentions.

| | |
|---|---|
| Student demo login | open <http://localhost:3000/l/KIM042>, or type code `KIM-042` at `/login`. That's **Andrew Kim, KAC-042, class 2-B**: 63/80 = 78.75% = B+ (A- after the +5% break-in) |
| Admin demo login | <http://localhost:3000/admin> · `admin` / `classdismissed` |

> The embedded database is for local use only. It refuses to run on Vercel. Change the demo admin
> password (or delete the account) before a real event: see *Staff accounts* below.

Test on a real phone on the same Wi-Fi: `npm run dev`, then open `http://<your-laptop-ip>:3000`
(`allowedDevOrigins` in `next.config.ts` already allows private LAN addresses). Note: phones only allow the camera on **https** pages (or `localhost`), so the login page's **Scan my QR card** button won't open the camera over `http://<ip>:3000`. Type the code there, or test the scanner on a deployed https URL.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 33 unit + integration tests (grading, timetable, schema, seed, Principal's Office corrections, sessions). Runs on in-memory Postgres; set `TEST_DATABASE_URL` to run the *same* suite on any real Postgres |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` to `DATABASE_URL` (or the embedded DB) |
| `npm run db:migrate:prod` | Same, but asks for the connection string hidden — run this **after every deploy that adds a migration** |
| `npm run db:seed` | Wipe event data and load the **demo** state (After School, sample notes/attempts/detentions). Keeps staff accounts |
| `npm run db:seed -- --profile=fresh` | Same roster, but a clean **School Day**: no scores, notes or attempts (rehearsal) |
| `npm run db:seed -- --profile=blank` | Config only (classes, subjects, clubs, tiers, grades). **No students**: the starting point for the real event |
| `npm run admin:create -- you@x.com "password" "Your Name" [admin\|teacher]` | Create (or reset) a staff account |

Seed flags: `--yes` skips the "type wipe" prompt when `DATABASE_URL` is set · `--demo-admin` creates the demo admin on a remote DB (it is *not* created on remote databases by default).

---

## Architecture

```
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4
        │
        ├─ Student app  (student)/…   server-rendered per request, signed-cookie session
        ├─ Staff room   /admin/…      server-rendered + small client "desks" for live tools
        ├─ Server actions  src/actions/*   every mutation: auth → permission → zod → transaction → audit
        ├─ Domain logic    src/lib/domain/* pure functions (grades, standings, timetable, stats, eligibility)
        └─ DB layer        src/lib/db/*     one tagged-template API over two backends:
                              DATABASE_URL set → `postgres` (Supabase pooler)      ← production
                              blank            → PGlite (embedded, .data/pglite)   ← local demo
```

Design decisions worth knowing:

* **Derived values are never stored.** A class's raw score, %, and letter are computed from
  `class_subject_scores`. **Current % = original % + Σ active `grade_modifications`.** So the *original*
  result always survives, and undoing a Principal's Office result is a single `revoked_at`.
* **Teams, not individuals.** Even in free-flow After School the classes walk around together, so a
  club is completed by a *class*, a Teacher's Note is earned by a *class*, and a Principal's Office attempt is made
  by a *class*. **Every attempt spends notes**: `available = earned − notes spent by the class's attempts`. Each attempt records how many notes it
  spent when it was made (the full price, or only what the class actually has if an exec overrides, so a class can
  never go into debt), and changing the price later doesn't rewrite history. Voiding an attempt refunds exactly what it spent. A caught attempt on a detention tier sends every
  present member of the class to detention. The only individual records left are detention and attendance.
* **Nothing an exec does is destroyed.** Notes, completions, attempts, grade changes and detentions are
  revoked/voided/cancelled, never deleted, and every action is written to `audit_log` in the same transaction.
* **Realtime that can't fail silently.** A single `live_state.rev` counter ticks (DB triggers) whenever
  anything a student can see changes. Phones (1) poll `/api/live` every 5 s (CDN-cacheable, no private data)
  and (2) optionally subscribe to Supabase Realtime for instant pushes. Either just notices "the counter
  moved" and re-renders the page. Polling pauses in a hidden tab and catches up the moment the app
  regains focus. An offline pill appears after two failed polls.
* **All data access is server-side.** Browsers never talk to the database. Row-level security is enabled
  on every table with no policies, so the public anon key can read nothing except the heartbeat row.
  Login codes are never loaded into the shared data model, so they can't leak through a page prop.
* **Auth without a third party.** Students: a 6-character code (QR on their card → `/l/CODE`), stored as
  an HMAC-signed httpOnly cookie, invalidated by `session_version` ("sign out of all phones"). Staff:
  username + scrypt-hashed password, 24 h signed cookie, login rate-limited. *(Supabase Auth was considered;
  one fewer moving part on the night, and it works identically locally.)*
* **Roles.** `admin`: everything. `teacher` ("game master"): **only the "During event" tools**: Score entry,
  Teacher's Notes, Principal's Office and Detention. Every other staff-room page, and every action behind
  them, is admin-only. It's enforced on the server (pages and actions), not just hidden from the menu, and a
  test fails if a new admin page is added without a permission check. Game masters land on Score entry when they sign in.
* **Maths toss challenge.** Whichever subject is flagged `is_maths_challenge` (MATHS by default; toggle it on
  any subject from *Timetable & subjects*, one at a time) gets a bonus: while a class is in that subject —
  School Day only — each student sees a **Maths** tab. Solve 3 arithmetic questions in a row (a miss just
  resets the streak and hands over a new question, no penalty) to win a few seconds' window to go make the
  physical toss, shown live on the `/math` leaderboard so the exec running the table knows who's up. The
  window closes itself (no exec action needed) and hands the student a fresh question, so they can win
  another; *Maths tosses* in the staff room (admin-only; a game-master tool would be reasonable too, ask if
  you want it added) just shows the queue and can end a window early. Answers are generated and checked
  server-side and never sent to the browser.
* **Buzzer round.** Whichever subject is flagged `is_buzzer_challenge` (SOCIAL STUDIES by default, same
  one-at-a-time toggle as Maths) gets live trivia: while a class is in that subject, students see a
  **Buzzer** tab with one big button. An exec on *Buzzer* in the staff room (admin-only; same note as
  Maths tosses about adding game-master access) presses **Start the round**, then **Next question** to
  move through Q1, Q2, … Whoever buzzes first is locked in — server-side, by an atomic
  `UPDATE … WHERE buzzed_student_id IS NULL`, so two buzzes at the exact same instant can never both
  win (a dedicated test hammers this with real concurrent connections). The exec marks them correct or
  wrong, which logs to a running per-class scoreboard, then moves on; **Clear** undoes a mis-tap without
  touching the scoreboard or the question number.
* **`/tv/math` and `/tv/buzzer`: big screens for the venue.** No student or admin sign-in — open one
  straight from a TV/Chromecast browser and leave it running. `/tv` is deliberately a folder, not a
  single page: the same pattern (a subject flag, a student mini-game, a `/tv/<subject>` display) can be
  repeated for another subject as its own route under it, without touching the others — this is exactly
  how Buzzer was added alongside Math. `/tv/buzzer` shows the ID photo of whoever's buzzed in, which is
  the one place in the app any of that shows on an unauthenticated screen; it's the same name/class/photo
  every classmate can already see, shown here so the exec running the show knows who to hand the question
  to. Neither is linked from anywhere in the app, so each is only reachable by whoever has the URL; say
  if you'd like either behind a passphrase instead.

### Data model (`supabase/migrations/0001_schema.sql`, `0006_math_challenge.sql`, `0007_buzzer.sql`)

`events` (single row: identity, phase, every configurable rule) · `admins` · `classes` · `students` ·
`subjects` (+ `is_maths_challenge`, `is_buzzer_challenge`) · `periods` · `rotations` (period × class → subject + room) ·
`class_subject_scores` · `grade_boundaries` · `clubs` · `club_completions` · `teacher_notes` · `risk_tiers` ·
`principal_attempts` (with tier snapshots) · `grade_modifications` · `detentions` · `photos` · `audit_log` ·
`live_state` · `math_challenges` (one row per student per period: streak, current question, status) ·
`buzzer_state` (single row: the live round) · `buzzer_rounds` (the scoreboard: one row per resolved question).

Unique partial indexes enforce the live-event edge cases in the database itself: one active completion and one active note per
**class** per club (double-tap safe), one current photo per student/kind.

### Routes

**Student** `/` (Home: changes by phase, and is the timetable during School Day) · `/clubs` · `/clubs/[id]` · `/class` ·
`/standings` · `/profile` · `/login` · `/l/[code]` (QR sign-in) · `/math` (Maths toss challenge + leaderboard; nav
tab only shows while it's your class's own Maths period) · `/buzzer` (live trivia buzzer; nav tab only
shows while it's your class's own Social Studies period)

**Public, no sign-in** `/tv/math` (Maths toss activity feed) · `/tv/buzzer` (Buzzer round) — both for a venue screen

**Staff** `/admin` (event control) · `/checkin` · `/scoring` · `/notes` · `/principal` · `/detention` ·
`/leaderboard` · `/stats` · `/math` (Maths toss queue) · `/buzzer` (run the trivia round) · `/students` (+ `/[id]`, `/import`, `/cards` printable login cards) · `/classes` (+ `/[id]`) ·
`/timetable` (times, matrix, subjects) · `/clubs` · `/settings` (rules, grade boundaries, risk tiers, reset) · `/staff` · `/activity`

---

## Supabase setup (production)

> **Shortcut: one command.** After you've created the Supabase project (step 1 below) and have the connection string
> and keys to hand, run `npm run setup:production`. It asks for them (input is hidden), checks them for the classic
> mistakes (a *secret* key pasted into the public slot, a connection string from a different project, the direct
> connection instead of the pooler), builds the tables, loads the blank event setup, creates your admin login,
> checks the photo bucket, and writes `.env.production.local`: the exact settings to paste into Vercel
> (`pbcopy < .env.production.local`, then paste into Vercel's Environment Variables). It's safe to re-run: it never
> wipes students or scores that already exist, and it keeps your session secret. Delete the file once Vercel has it.
> The numbered steps below are the same thing done by hand.

1. **Create a project** at supabase.com (choose a region near Auckland: Sydney).
2. **Database connection string**: *Project Settings → Database → Connection string → Transaction pooler*
   (port `6543`). Copy the URI and put your database password in it → this is `DATABASE_URL`.
3. **API keys**: *Project Settings → API*. Copy the project URL, the `anon` key, and the `service_role` key.
4. **Environment**: `cp .env.example .env.local` and fill in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Transaction-pooler URI (step 2) |
   | `SESSION_SECRET` | `openssl rand -base64 48`: **required whenever `DATABASE_URL` is set or on Vercel** (the app refuses to sign cookies without it); signs all cookies |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (used for Storage + the browser Realtime channel) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (public; can only read the heartbeat row) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key. **Server only.** Never prefix with `NEXT_PUBLIC_` |
   | `SUPABASE_STORAGE_BUCKET` | `photos` (default) |
   | `APP_URL` | Your public URL, used in QR codes (optional; falls back to the request host) |

5. **Create the tables**: with `DATABASE_URL` in `.env.local` exported (or inline), run:
   ```bash
   DATABASE_URL='postgresql://…6543/postgres' npm run db:migrate
   ```
   or, to be asked for the connection string hidden instead of typing it into a visible command:
   ```bash
   npm run db:migrate:prod
   ```
   Use this command rather than pasting SQL into the Supabase editor: it applies all the files in
   `supabase/migrations/` in order and remembers which ones ran, so it stays safe to re-run when a later
   update adds a migration. (Don't mix the two approaches.) The migrations also enable RLS, create the public `photos` storage bucket, add `live_state` to the
   `supabase_realtime` publication, and add the anon read policy. Each Supabase-specific step is best-effort;
   if any prints a notice, do it by hand: Storage → new **public** bucket `photos`; Database → Replication →
   enable `live_state`; and an RLS `SELECT` policy on `live_state` for `anon`.

   **Run this again after every `git push` that adds a file to `supabase/migrations/`** — a deploy ships the
   new code immediately, but never touches the database on its own. `/api/health` on your live site shows
   "tables up to date": "failed" until you do. (Running `npm run db:migrate` with no `DATABASE_URL` set
   migrates the local embedded demo database instead of production — harmless, but not what you want here.)
6. **Load starting data**: for the real event start from the *blank* profile and add your students:
   ```bash
   DATABASE_URL='…' npm run db:seed -- --profile=blank --yes
   DATABASE_URL='…' npm run admin:create -- you@kac.nz "password" "Your Name" admin
   ```
   then paste your sign-up list under **Students → Import list** (numbers, codes and balanced classes are automatic).
   To preview with fake people first: `--profile=demo`.

## Deploying to Vercel

1. Push the repo, import it in Vercel (framework: Next.js, defaults are fine).
2. Add the environment variables above (Production + Preview). Set `SESSION_SECRET`.
3. Deploy, then open `https://<your-app>/admin` and sign in.

Notes: every screen is server-rendered on demand (nothing touches the database at build time, so the build works even before your database exists). `vercel.json` pins the app's servers to **Sydney (`syd1`)** so they sit next to a Sydney Supabase database; if you put your Supabase project in another region, change it to match (Vercel's Hobby plan allows one region). The app uses the `postgres` driver with
`prepare: false`, which is what Supabase's transaction pooler needs. Photos go to Supabase Storage
(Vercel's disk is read-only); the app refuses to start uploads without it rather than losing photos.

---

## Running the night: admin workflow

**Before the event (week of)**
1. *Settings*: check event details, rooms, Teacher's Notes each attempt costs, detention room.
   Tune **grade boundaries** and **risk tiers** (success/failure %, detention on failure): all editable.
2. *Students → Import list*, then eyeball class sizes (or "Auto-balance"). *Print login cards* (QR + code).
3. *Timetable & subjects*: set rotation times, press **Auto-generate** (Latin-square: every class meets every
   subject once, no shared rooms), tweak cells; collisions light up red. Edit subjects (name, tagline,
   activity text, max mark, room pool).
4. *Clubs*: add/edit/remove (removed = hidden, restorable, notes kept), set rooms, decide which award a note.
5. **Rehearse** with `--profile=fresh` (or the demo), then press **Start the event fresh** (Event control, bottom of the page).

**At sign-in**: *Check-in* → find by name or number (or tap a name in the **Still to arrive / Arrived / Absent** boxes below) → **Take photo** (camera
opens; downscaled in-browser so it uploads fast) → mark Present → hand over the card.

**Phase 1 (School Day)**: *Event control → Rotation bell*: press **Ring bell** to start each rotation
(resilient when the night runs late; or switch to clock-driven). Teachers enter marks in *Score entry*
(pick subject → type mark → Save; mistakes are simply re-saved, and every change is audited).
Room changed at the last minute? *Timetable* → edit the room; phones update automatically.

**Switching phase**: *Event control* → tap **After School** → confirm. Backwards is allowed and warned
(no data is lost). Lock scoring first if you want a hard stop.

**Phase 2 (After School)**: *Teacher's Notes*: pick the club, tap the **class** (or several), one big button; the
class earns the note. Duplicates are refused; anything can be undone. Students see their class's balance as
*available / needed* (e.g. **1 / 3**), which drops when the team goes into the Principal's Office.
*Principal's Office*: there is no student-facing screen; you run it in the room. Tap the **class** that went in
(each tile shows its notes left and whether it can go in), pick the risk level *they chose*, run the challenge,
tap **SUCCESS** or **CAUGHT**. The attempt spends the notes, the class grade updates instantly, and a caught result
on a detention tier sends the whole class to detention. Entered wrong? **Change to caught/success** or **Void**:
the grade change and detentions are reversed and the notes refunded. *Detention*: a team detention is one group with
**SERVE ALL** (or release students one by one); **Cancel** / **Re-open** fix mistakes. Anyone can also be sent to
detention individually.

**Finale**: *Leaderboard* (exact numbers, staff-only) → announce winners → *Event control → Event Complete*.
Every student's Home becomes the keepsake. *Final stats* has all the special awards and lets you override any
student's award. Upload class/team photos on each class page and a final photo per student (optional).

### Can't sign in to the staff room?
Run `npm run admin:reset`. It asks for your Supabase connection string (and database password), then **lists the admin
accounts that exist (usernames only)**, so you can see which username you actually created, and lets you set a new password for
one of them (or create an account). Every prompt is hidden and no event data is touched. It only needs the database
connection, never the API keys.

### A page won't load, or crashes after signing in?
Run `npm run doctor`. It reads `.env.production.local` (the settings file the setup command wrote), then runs what the admin
page and sign-in do against your real database and says which step fails and why: settings, connection, admin accounts,
tables, event data, sign-in cookie, and (optionally) your password. Nothing is typed except the optional password, which is
hidden, and error text has every secret removed before it's shown. If a page crashes, the screen offers **Try again** and
**Sign out**, so a crash never locks anyone out of the staff room.

### Staff accounts
`npm run admin:create -- username password "Name" admin|teacher` (also creates or resets). In the app:
*Staff accounts* to add game masters, change roles, deactivate accounts, and change your own password.
**Delete or change the demo `admin` account before the event.**
Staff sign in with a **username** (1–40 characters, no spaces; not case-sensitive). It is stored in the `admins.email` column, which keeps its old name so no database migration was needed.

### Resetting
| Goal | How |
|---|---|
| Start the event fresh (after a rehearsal, or to redo the night) | *Event control → Start the event fresh* (admins only; type `RESET`). Clears scores, notes, club completions, attempts, grade changes, detentions and check-ins, and returns to School Day before the first bell. **Keeps** classes and names, students and login cards, ID/team photos, clubs, subjects, timetable, rules, grade boundaries, risk tiers, staff accounts and the activity log |
| Fresh demo data (local) | `npm run db:reset` (or delete `.data/` and restart `npm run dev`) |
| Clean roster for real, no students | `DATABASE_URL=… npm run db:seed -- --profile=blank --yes` |

### Live-event safety nets
Late arrivals (attendance: expected / present / absent) · unequal class sizes (percentages, not totals) ·
score corrections (re-save, audited; scoring lock) · duplicate Teacher's Note (blocked with a clear message) ·
detention mistakes (cancel / re-open) · wrong Principal's Office result (flip or void; grade change reversed, notes refunded) ·
manual grade adjustments (reversible) · accidental phase change (confirm dialog + freely reversible) ·
students swapping phones (re-scan the QR; "sign out of all phones") · bad mobile signal (polling fallback,
offline pill, everything idempotent) · removed clubs (archived, restorable) · room changes (instant).

---

## Testing & verification

* `npm test`: 33 tests: grade maths (incl. the brief's 63/80 → 78.75% → B+ → +5% → 83.75% A-), ranking ties,
  timetable collision-freedom, event timezone (NZDT), schema + seed sanity, Principal's Office
  success → caught → success → void reversals, sessions/passwords.
* The same suite was run against **real PostgreSQL** (`TEST_DATABASE_URL`) to prove the `postgres` driver
  path used with Supabase (this caught a JSON double-encoding bug that PGlite hid; fixed in `src/lib/db/sql.ts`).
* Manual, in a browser against both backends: QR sign-in, phase flip propagating to a second "phone",
  overlay, scoring, note award + duplicate, attempt correction, detention takeover/release, keepsake, and a
  smoke render of every route.

**Not exercised here** (needs your real Supabase project or a device): Supabase **Storage** uploads,
Supabase **Realtime** push (polling covers it either way), the **Scan my QR card** camera button on the login page (needs https; typing the code is the fallback), and iOS Safari specifics. Try each once during rehearsal.

## Customising

* **Crest**: `src/components/ui/crest.tsx` draws the shield and book around the KAC dragon in `public/kac-dragon.png` (transparent PNG, ~256px). Swap that file to change the mascot; the shield/book/size live in the component. It's used on every ID card, header, login card and keepsake.
* **Colours / fonts**: tokens at the top of `src/app/globals.css`; fonts in `src/app/layout.tsx`.
* **New final stat**: add one line to `computeFinalStats` in `src/lib/domain/stats.ts`.
* **New special award rule**: `awardFor` in the same file.
* **Risk-tier variations later**: add columns to `risk_tiers` / the tier form; attempts snapshot the numbers used.

## Troubleshooting

* *"DATABASE_URL is not set" on Vercel*: add the pooler URL under Project → Settings → Environment Variables and redeploy.
* *Students can't sign in after a redeploy*: `SESSION_SECRET` changed. Keep it constant, or have them scan their card again.
* *Photos won't upload in production*: check `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and that bucket `photos` exists and is **public**.
* *Phone doesn't update instantly*: it's polling every 5 s. Realtime needs the URL + anon key set and `live_state` in the publication.
* *Wipe the local demo DB*: stop the server and delete `.data/`.
