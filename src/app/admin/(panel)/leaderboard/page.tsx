import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { computeStandings, formatDelta, formatPct } from "@/lib/domain/grades";
import { readableOn } from "@/lib/cn";

export const metadata = { title: "Leaderboard" };

export default async function AdminLeaderboard() {
  await requireAdminPage("manage");
  const w = await getWorld();
  const rows = computeStandings(w);
  const mode = { exact: "exact percentages", grades: "grades only", hidden: "hidden" }[w.event.leaderboardMode];
  return (
    <>
      <PageHeader title="Leaderboard" hint="staff always see the exact numbers" actions={<Chip tone="soft">Students see: {mode}</Chip>} />
      <Panel>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="label"><tr><th className="p-2">#</th><th className="p-2">Class</th><th className="p-2">Marks</th><th className="p-2">Original</th><th className="p-2">Changes</th><th className="p-2 text-right">Current</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.klass.id}>
                  <td className="display p-2 text-2xl">{r.rank}</td>
                  <td className="p-2"><Link href={`/admin/classes/${r.klass.id}`} className="display rounded-lg px-2 py-1 text-lg" style={{ background: r.klass.color, color: readableOn(r.klass.color) }}>{r.klass.name}</Link></td>
                  <td className="p-2 tabular">{r.scoredCount ? `${r.raw}/${r.max}` : "—"} <span className="text-xs text-ink-soft">({r.scoredCount}/{r.subjectCount})</span></td>
                  <td className="p-2 tabular">{formatPct(r.originalPct)} <b>{r.originalGrade}</b></td>
                  <td className={`p-2 tabular font-bold ${r.modDelta > 0 ? "text-emerald-700" : r.modDelta < 0 ? "text-pen" : "text-ink-soft"}`}>{r.modDelta ? formatDelta(r.modDelta) : "none"}</td>
                  <td className="display p-2 text-right text-xl tabular">{formatPct(r.currentPct)} <span className="text-pen">{r.currentGrade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-3 text-sm text-ink-soft">Change what students see under Event control → Live switches.</p>
    </>
  );
}
