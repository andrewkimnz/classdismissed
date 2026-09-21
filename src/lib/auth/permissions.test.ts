import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_NAV, DURING_EVENT, DURING_EVENT_HREFS, visibleNav } from "@/lib/admin-nav";
import { DURING_EVENT_PAGES, ROLE_PERMS, can, homePath } from "./permissions";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const teacher = { role: "teacher" as const };
const admin = { role: "admin" as const };
const TEACHER_PERMS = ROLE_PERMS.teacher;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

describe("game master permissions", () => {
  it("a game master holds exactly the four During-event permissions; an admin holds everything", () => {
    assert.deepEqual([...TEACHER_PERMS].sort(), ["detention", "notes", "principal", "score"]);
    for (const p of ["manage", "checkin"] as const) assert.equal(can(teacher, p), false, `teacher must not have ${p}`);
    for (const p of ROLE_PERMS.admin) assert.equal(can(admin, p), true);
  });

  it("lands each role on a page it can actually open", () => {
    assert.equal(homePath(admin), "/admin");
    assert.equal(homePath(teacher), "/admin/scoring");
    const home = DURING_EVENT_PAGES.find((p) => p.href === homePath(teacher))!;
    assert.ok(can(teacher, home.perm), "no redirect loop: the home page must be permitted");
  });
});

describe("staff-room menu", () => {
  it("has a 'During event' section holding exactly Score entry, Teacher's Notes, Principal's Office, Detention", () => {
    const items = ADMIN_NAV.filter((i) => i.group === DURING_EVENT).map((i) => i.href);
    assert.deepEqual(items, ["/admin/scoring", "/admin/notes", "/admin/principal", "/admin/detention"]);
    assert.deepEqual(items, DURING_EVENT_HREFS);
    // and those four are no longer under "Run the night"
    assert.deepEqual(ADMIN_NAV.filter((i) => i.group === "Run the night").map((i) => i.href), ["/admin", "/admin/checkin"]);
  });

  it("shows a game master ONLY the During event section, and an admin everything", () => {
    assert.deepEqual(visibleNav(false).map((i) => i.href), DURING_EVENT_HREFS);
    assert.equal(visibleNav(true).length, ADMIN_NAV.length);
    const groupOrder = [...new Set(visibleNav(true).map((i) => i.group))];
    assert.deepEqual(groupOrder, ["Run the night", DURING_EVENT, "Results", "Set up"]);
  });
});

describe("server-side enforcement (not just a hidden menu)", () => {
  const pages = walk("src/app/admin/(panel)").filter((f) => f.endsWith("page.tsx"));
  const routeOf = (f: string) => "/admin" + f.replace(/^src\/app\/admin\/\(panel\)/, "").replace(/\/?page\.tsx$/, "");

  it("finds the admin pages", () => assert.ok(pages.length >= 15, `found ${pages.length}`));

  it("every admin page states its permission explicitly", () => {
    for (const f of pages) assert.match(read(f), /requireAdminPage\("(\w+)"\)/, `${f} must call requireAdminPage("<permission>")`);
  });

  it("only the four During-event pages accept a game master; every other page needs a permission they lack", () => {
    for (const f of pages) {
      const perm = /requireAdminPage\("(\w+)"\)/.exec(read(f))![1] as (typeof TEACHER_PERMS)[number];
      const route = routeOf(f);
      const during = DURING_EVENT_PAGES.find((p) => p.href === route);
      if (during) {
        assert.equal(perm, during.perm, `${route} should require ${during.perm}`);
        assert.ok(can(teacher, perm), `${route} must be open to game masters`);
      } else {
        assert.equal(can(teacher, perm), false, `${route} requires "${perm}", which a game master has, so they could open it by URL`);
      }
    }
  });

  it("game-master permissions are only used by the four During-event action files", () => {
    const allowed: Record<string, string> = { score: "scoring.ts", notes: "notes.ts", principal: "principal.ts", detention: "detention.ts" };
    for (const f of fs.readdirSync(path.join(root, "src/actions")).filter((x) => x.endsWith(".ts"))) {
      for (const m of read(`src/actions/${f}`).matchAll(/run\("(\w+)"/g)) {
        const perm = m[1];
        if (perm in allowed) assert.equal(f, allowed[perm], `${f} uses the game-master permission "${perm}" outside its own tool`);
      }
    }
  });

  it("every button on the four game-master screens calls an action a game master may run", () => {
    // action name -> permission, from the source
    const perms = new Map<string, string>();
    for (const f of fs.readdirSync(path.join(root, "src/actions")).filter((x) => x.endsWith(".ts"))) {
      const src = read(`src/actions/${f}`);
      for (const m of src.matchAll(/export async function (\w+)[\s\S]*?run\("(\w+)"/g)) perms.set(m[1], m[2]);
    }
    for (const desk of ["scoring-desk", "notes-desk", "principal-desk", "detention-desk"]) {
      const src = read(`src/components/admin/${desk}.tsx`);
      const imported = [...src.matchAll(/import \{([^}]+)\} from "@\/actions\/\w+"/g)].flatMap((m) => m[1].split(",").map((n) => n.trim()).filter(Boolean));
      assert.ok(imported.length > 0, `${desk} should import actions`);
      for (const name of imported) {
        const perm = perms.get(name);
        assert.ok(perm, `unknown action ${name} in ${desk}`);
        assert.ok(TEACHER_PERMS.includes(perm as never), `${desk} calls ${name}(), which needs "${perm}": a game master would get an error`);
      }
    }
  });
});
