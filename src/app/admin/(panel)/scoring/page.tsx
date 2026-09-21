import { PageHeader } from "@/components/admin/ui";
import { ScoringDesk } from "@/components/admin/scoring-desk";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";
import { classTimetable } from "@/lib/domain/timetable";

export const metadata = { title: "Score entry" };

export default async function ScoringPage() {
  await requireAdminPage("score");
  const w = await getWorld();
  const now = Date.now();
  const liveSubject: Record<number, number | null> = {};
  for (const c of w.classes) liveSubject[c.id] = classTimetable(w, c.id, now).find((r) => r.status === "now")?.rotation?.subjectId ?? null;
  return (
    <>
      <PageHeader title="Score entry" hint="pick a subject · type the class mark · save" />
      <ScoringDesk
        classes={w.classes.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        subjects={w.subjects.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, icon: s.icon, color: s.color, maxScore: s.maxScore }))}
        scores={w.scores.map((s) => ({ classId: s.classId, subjectId: s.subjectId, score: s.score }))}
        liveSubject={liveSubject}
        locked={w.event.scoringLocked}
      />
    </>
  );
}
