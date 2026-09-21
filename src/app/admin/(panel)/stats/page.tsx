import { AwardsTable } from "@/components/admin/awards-table";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { can, requireAdminPage } from "@/lib/auth/admin";
import { readableOn } from "@/lib/cn";
import { getWorld } from "@/lib/data/world";
import { awardFor, computeFinalStats, computeStudentStats, type StatBoard } from "@/lib/domain/stats";

export const metadata = { title: "Final stats" };

function Board({ b }: { b: StatBoard }) {
  const winners = b.entries.filter((e) => e.isWinner);
  return (
    <section className="card bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="text-4xl">{b.emoji}</div>
        <div className="min-w-0 flex-1"><h3 className="display text-xl leading-tight">{b.title}</h3><p className="hand text-lg leading-none text-ink-soft">{b.blurb}</p></div>
        <Chip tone="soft">{b.scope}</Chip>
      </div>
      {b.entries.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Nobody yet.</p> : (
        <>
          <div className="mt-3 rounded-2xl border-2 border-ink bg-sun p-3 shadow-[0_3px_0_var(--ink)]">
            <div className="label text-ink/70">{winners.length > 1 ? "Tied winners" : "Winner"}</div>
            {winners.map((e) => <div key={e.id} className="display text-2xl leading-tight">{e.name} <span className="text-base">· {e.display}</span></div>)}
          </div>
          <ol className="mt-2 space-y-1">
            {b.entries.filter((e) => !e.isWinner).map((e, i) => (
              <li key={e.id} className="flex items-center gap-2 text-sm"><span className="w-5 text-ink-soft">{i + winners.length + 1}.</span>{e.color && <span className="h-3 w-1.5 rounded-full" style={{ background: e.color }} />}<span className="flex-1 font-bold">{e.name}{e.sub && <span className="font-semibold text-ink-soft"> · {e.sub}</span>}</span><span className="tabular text-ink-soft">{e.display}</span></li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default async function StatsPage() {
  const admin = await requireAdminPage("manage");
  const w = await getWorld();
  const boards = computeFinalStats(w);
  const stats = computeStudentStats(w);
  const rows = w.students.map((s) => ({ id: s.id, name: s.name, className: w.classes.find((c) => c.id === s.classId)?.name ?? null, auto: awardFor(stats.get(s.id)!, null).title, custom: s.customAward ?? "" }));
  void readableOn;
  return (
    <>
      <PageHeader title="Final stats" hint="calculated live from everything that happened" />
      <h2 className="display mb-2 text-2xl">Class awards</h2>
      <div className="mb-6 grid gap-3 md:grid-cols-2">{boards.filter((b) => b.scope === "class").map((b) => <Board key={b.id} b={b} />)}</div>
      <h2 className="display mb-2 text-2xl">Student awards</h2>
      <div className="mb-6 grid gap-3 md:grid-cols-2">{boards.filter((b) => b.scope === "student").map((b) => <Board key={b.id} b={b} />)}</div>
      <Panel title="Keepsake awards"><p className="mb-3 text-sm text-ink-soft">Every student’s keepsake shows a special award. It’s automatic, but you can override any of them.</p><AwardsTable rows={rows} canManage={can(admin, "manage")} /></Panel>
    </>
  );
}
