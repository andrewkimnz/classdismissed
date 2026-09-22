import { TvBoard } from "@/components/tv/tv-board";
import { getLiveState } from "@/lib/data/live";
import { getMathLeaderboard } from "@/lib/data/math";

export const metadata = { title: "Maths toss — display", robots: { index: false, follow: false } };

// A screen for a TV in the venue, not a signed-in person: no student or admin session, nothing to
// click. It only ever reads the same data every student's own Maths page already shows them, in the
// same shape — nothing here needs, or checks, who's watching. Never touches the database at build time.
export const dynamic = "force-dynamic";

export default async function TvMathPage() {
  const live = await getLiveState();
  const board = await getMathLeaderboard();

  const waiting = board
    .filter((r) => r.waiting)
    .sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0))
    .map((r) => ({ id: r.id, name: r.studentName, className: r.className, classColor: r.classColor, wonAt: (r.wonAt ?? new Date()).toISOString() }));

  const history = board
    .filter((r) => !r.waiting)
    .sort((a, b) => (b.lastTossedAt?.getTime() ?? 0) - (a.lastTossedAt?.getTime() ?? 0))
    .slice(0, 16)
    .map((r) => ({ id: r.id, name: r.studentName, className: r.className, classColor: r.classColor, tosses: r.tosses, lastTossedAt: r.lastTossedAt?.toISOString() ?? null }));

  return <TvBoard rev={live.rev} waiting={waiting} history={history} />;
}
