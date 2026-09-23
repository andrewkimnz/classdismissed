import { BuzzerDesk } from "@/components/admin/buzzer-desk";
import { PageHeader } from "@/components/admin/ui";
import { getBuzzerAdminLive, getBuzzerHistory, getBuzzerQuestions } from "@/lib/data/buzzer";
import { getLiveState } from "@/lib/data/live";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Buzzer" };

export default async function BuzzerAdminPage() {
  await requireAdminPage("manage");
  const [state, history, questions, live] = await Promise.all([getBuzzerAdminLive(), getBuzzerHistory(50), getBuzzerQuestions(), getLiveState()]);
  return (
    <>
      <PageHeader title="Buzzer" hint="run the trivia round" />
      <BuzzerDesk
        rev={live.rev}
        state={{
          questionNumber: state.questionNumber,
          questionText: state.questionText,
          choices: state.choices,
          correctIndex: state.correctIndex,
          buzzedStudentId: state.buzzedStudentId,
          buzzedStudentName: state.buzzedStudentName,
          className: state.className,
          classColor: state.classColor,
          photoUrl: state.photoUrl,
          buzzedAt: state.buzzedAt?.toISOString() ?? null,
          result: state.result,
        }}
        history={history.map((r) => ({
          id: r.id, questionNumber: r.questionNumber, questionText: r.questionText, studentName: r.studentName, className: r.className, classColor: r.classColor,
          result: r.result, resolvedAt: r.resolvedAt.toISOString(),
        }))}
        questionCount={questions.length}
      />
    </>
  );
}
