import { Leaderboard } from "@/components/student/parts";
import { requireStudent } from "@/lib/auth/student";
import { computeStandings } from "@/lib/domain/grades";

export const metadata = { title: "Standings" };

export default async function StandingsPage() {
  const { student, world } = await requireStudent();
  const { event } = world;
  const rows = computeStandings(world);
  const note =
    event.phase === "school_day" ? "Ranked by school-day marks so far." : event.phase === "after_school" ? "Ranked by CURRENT grade, including any... creative record-keeping." : "Final standings. Highest final grade wins.";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-4xl leading-none">Class Standings</h1>
        <p className="hand text-2xl leading-none text-sakura-deep">KAC Academy leaderboard</p>
      </div>
      <p className="text-sm text-ink-soft">{event.leaderboardMode === "hidden" ? "" : note}</p>
      <Leaderboard rows={rows} mode={event.leaderboardMode} myClassId={student.classId} />
    </div>
  );
}
