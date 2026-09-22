import Link from "next/link";
import { BellControl, EventToggles, PhaseControl } from "@/components/admin/event-control";
import { PageHeader, Panel } from "@/components/admin/ui";
import { StartFreshPanel } from "@/components/admin/start-fresh";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { getAuditLog } from "@/lib/data/admin";
import { sql } from "@/lib/db/client";
import { countEventActivity } from "@/lib/reset";
import { getWorld } from "@/lib/data/world";
import { getMathLeaderboard } from "@/lib/data/math";
import { computeStandings, formatPct } from "@/lib/domain/grades";
import { formatEventDate, timeAgo } from "@/lib/domain/time";

export const metadata = { title: "Event control" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdminPage("manage");
  const { denied } = await searchParams;
  const w = await getWorld();
  const audit = await getAuditLog(8);
  const counts = can(admin, "manage") ? await countEventActivity(sql) : null;
  const { event } = w;
  const standings = computeStandings(w);
  const present = w.students.filter((s) => s.attendance === "present").length;
  const attempts = w.attempts.filter((a) => a.status === "resolved").length;
  const detained = w.detentions.filter((d) => d.status === "pending").length;
  const cells = w.classes.length * w.subjects.filter((s) => s.active).length;
  const marked = w.scores.length;
  const readyToToss = (await getMathLeaderboard()).filter((r) => r.waiting).length;
  const tiles: { label: string; value: string; href: string; hot?: boolean }[] = [
    { label: "Checked in", value: `${present}/${w.students.length}`, href: "/admin/checkin" },
    { label: "Scores entered", value: `${marked}/${cells}`, href: "/admin/scoring" },
    { label: "Teacher’s Notes", value: String(w.notes.length), href: "/admin/notes" },
    { label: "Office attempts", value: String(attempts), href: "/admin/principal" },
    { label: "In detention", value: String(detained), href: "/admin/detention", hot: detained > 0 },
    { label: "Leader", value: standings[0]?.currentPct !== null ? `${standings[0]?.klass.name} ${formatPct(standings[0]?.currentPct ?? null)}` : "—", href: "/admin/leaderboard" },
    { label: "Waiting to toss", value: String(readyToToss), href: "/admin/math", hot: readyToToss > 0 },
  ];
  return (
    <>
      <PageHeader title="Event control" hint={`${event.name} · ${formatEventDate(event.eventDate)}`} />
      {denied && <p className="mb-4 rounded-xl border-2 border-pen bg-pen/10 p-3 text-sm font-bold text-pen">Your role doesn’t include that page. Ask an admin if you need it.</p>}
      <div className="space-y-4">
        {can(admin, "manage") ? <PhaseControl phase={event.phase} /> : (
          <Panel><div className="text-sm text-ink-soft">Current phase</div><div className="display text-3xl">{event.phase.replace("_", " ").toUpperCase()}</div><p className="text-xs text-ink-soft">Only admins can change the phase.</p></Panel>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className={`card-soft block border-2 p-3 active:bg-paper-2 ${t.hot ? "border-pen bg-pen/5" : ""}`}>
              <div className="label">{t.label}</div>
              <div className={`display text-3xl tabular ${t.hot ? "text-pen" : ""}`}>{t.value}</div>
            </Link>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <BellControl event={event} periodCount={w.periods.length} canManage={can(admin, "manage")} />
          <EventToggles event={event} canManage={can(admin, "manage")} />
        </div>
        <Panel title="Latest activity" right={<Link href="/admin/activity" className="text-sm font-extrabold text-accent">Everything →</Link>}>
          {audit.length === 0 ? <p className="text-sm text-ink-soft">Nothing yet.</p> : (
            <ul className="divide-y divide-line">
              {audit.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 py-2 text-sm"><span><b>{a.adminName}</b> · {a.summary}</span><span className="shrink-0 text-xs text-ink-soft">{timeAgo(a.at)}</span></li>)}
            </ul>
          )}
        </Panel>
        {counts && <StartFreshPanel counts={counts} />}
      </div>
    </>
  );
}
