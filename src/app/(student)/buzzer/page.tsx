import { BuzzerPanel } from "@/components/student/buzzer-panel";
import { requireStudent } from "@/lib/auth/student";
import { getBuzzerLive } from "@/lib/data/buzzer";
import { getLiveState } from "@/lib/data/live";
import { buzzerStatusForClass, currentBuzzerSlot } from "@/lib/domain/buzzer";

export const metadata = { title: "Buzzer" };

const NOT_NOW_MESSAGE: Record<ReturnType<typeof buzzerStatusForClass>, string> = {
  not_school_day: "The Buzzer round only runs during School Day.",
  no_class: "You're not assigned to a class yet — ask an exec at the sign-in desk.",
  upcoming: "Your class hasn't reached Social Studies yet. Check Home for when you're up.",
  complete: "Your class has already had its turn at Social Studies today.",
  no_buzzer: "Buzzer isn't part of today's rotation.",
};

export default async function BuzzerPage() {
  const { student, world } = await requireStudent();
  const slot = currentBuzzerSlot(world, student.classId);

  if (!slot) {
    return (
      <div className="card bg-white p-5 text-center">
        <div className="text-4xl">🔔</div>
        <div className="display mt-1 text-2xl">Buzzer</div>
        <p className="mt-1 text-sm text-ink-soft">{NOT_NOW_MESSAGE[buzzerStatusForClass(world, student.classId)]}</p>
      </div>
    );
  }

  const [live, state] = await Promise.all([getLiveState(), getBuzzerLive()]);
  return (
    <BuzzerPanel
      rev={live.rev}
      questionNumber={state.questionNumber}
      buzzedStudentId={state.buzzedStudentId}
      buzzedStudentName={state.buzzedStudentName}
      className={state.className}
      result={state.result}
      myStudentId={student.id}
    />
  );
}
