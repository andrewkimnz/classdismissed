import { ClubCard, LockedScreen, NotesProgress } from "@/components/student/parts";
import { Card, Empty } from "@/components/ui/kit";
import { requireStudent } from "@/lib/auth/student";
import { buildStudentView } from "@/lib/domain/student-view";

export const metadata = { title: "Clubs" };

export default async function ClubsPage() {
  const { student, world } = await requireStudent();
  const { event } = world;
  if (event.phase === "school_day") {
    return (
      <LockedScreen emoji="🔔" title="Clubs open after school" />
    );
  }
  if (event.phase === "event_complete") {
    return <LockedScreen emoji="🎓" title="The clubs have closed">Thanks for joining in! Your keepsake is waiting on the home tab.</LockedScreen>;
  }
  const v = buildStudentView(world, student);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl leading-none">After School Clubs</h1>
      </div>
      <Card><NotesProgress clubs={v.noteClubs} done={v.doneClubIds} balance={v.notes} className={v.klass?.name} /></Card>
      {world.clubs.length === 0 ? (
        <Empty emoji="🎒" title="No clubs yet">The execs are setting them up.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {world.clubs.map((c) => <ClubCard key={c.id} club={c} done={v.doneClubIds.has(c.id)} href={`/clubs/${c.id}`} />)}
        </div>
      )}
    </div>
  );
}
