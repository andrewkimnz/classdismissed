import { BottomNav } from "@/components/student/bottom-nav";
import { DetentionScreen } from "@/components/student/detention-screen";
import { LiveProvider } from "@/components/student/live-provider";
import { PhaseOverlay } from "@/components/student/phase-overlay";
import { Crest, Wordmark } from "@/components/ui/crest";
import { Chip } from "@/components/ui/kit";
import { requireStudent } from "@/lib/auth/student";
import { getLiveState } from "@/lib/data/live";
import { currentBuzzerSlot } from "@/lib/domain/buzzer";
import { currentMathsSlot } from "@/lib/domain/math";
import { pendingDetention } from "@/lib/domain/principal";
import { phaseLabel } from "@/lib/domain/phases";

// Everything here depends on the signed-in person and live data: never pre-render at build time (a build must not touch the database).
export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Read the heartbeat BEFORE the data so a refresh can never end up "newer than its own data".
  const live = await getLiveState();
  const { student, world } = await requireStudent();
  const { event } = world;
  const detention = event.phase === "event_complete" ? null : pendingDetention(world, student.id);
  const mathEligible = currentMathsSlot(world, student.classId) !== null;
  const buzzerEligible = currentBuzzerSlot(world, student.classId) !== null;
  const supabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
      : null;

  return (
    <div data-phase={event.phase} className="app-bg">
      <LiveProvider rev={live.rev} supabase={supabase} refreshEveryMs={event.timetableMode === "clock" && event.phase === "school_day" ? 20000 : undefined} />
      <PhaseOverlay phase={event.phase} />
      <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-32">
        <header className="flex items-center gap-2.5 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
          <Crest size={30} />
          <Wordmark />
          <span className="ml-auto">
            {detention ? <Chip tone="bad">🚨 Detention</Chip> : <Chip tone="accent">{event.phase === "school_day" ? "🔔 In session" : event.phase === "after_school" ? "🌸 After school" : "🎓 " + phaseLabel(event.phase)}</Chip>}
          </span>
        </header>
        <main>{detention ? <DetentionScreen detention={detention} event={event} name={student.name.split(" ")[0]} /> : children}</main>
      </div>
      {!detention && <BottomNav phase={event.phase} mathEligible={mathEligible} buzzerEligible={buzzerEligible} />}
    </div>
  );
}
