import { MathGame } from "@/components/student/math-game";
import { MathLeaderboard } from "@/components/student/math-leaderboard";
import { sql } from "@/lib/db/client";
import { requireStudent } from "@/lib/auth/student";
import { getActiveChallenge, getMathLeaderboard } from "@/lib/data/math";
import { currentMathsSlot, mathStatusForClass } from "@/lib/domain/math";

export const metadata = { title: "Maths" };

const NOT_NOW_MESSAGE: Record<ReturnType<typeof mathStatusForClass>, string> = {
  not_school_day: "The Maths toss challenge only runs during School Day.",
  no_class: "You're not assigned to a class yet — ask an exec at the sign-in desk.",
  upcoming: "Your class hasn't reached Maths yet. Check Home for when you're up.",
  complete: "Your class has already had its turn at Maths today.",
  no_maths: "Maths isn't part of today's rotation.",
};

export default async function MathPage() {
  const { student, world } = await requireStudent();
  const slot = currentMathsSlot(world, student.classId);
  const board = await getMathLeaderboard();

  if (!slot) {
    return (
      <div className="space-y-4">
        <div className="card bg-white p-5 text-center">
          <div className="text-4xl">🧮</div>
          <div className="display mt-1 text-2xl">Maths toss challenge</div>
          <p className="mt-1 text-sm text-ink-soft">{NOT_NOW_MESSAGE[mathStatusForClass(world, student.classId)]}</p>
        </div>
        <MathLeaderboard rows={board} />
      </div>
    );
  }

  const challenge = await getActiveChallenge(sql, student.id, slot.periodId);
  return (
    <div className="space-y-4">
      <MathGame
        status={challenge.status}
        streak={challenge.streak}
        question={challenge.question}
        wonAt={challenge.wonAt?.toISOString() ?? null}
        tosses={challenge.tosses}
      />
      <MathLeaderboard rows={board} />
    </div>
  );
}
