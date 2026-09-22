import { BuzzerDesk } from "@/components/admin/buzzer-desk";
import { PageHeader } from "@/components/admin/ui";
import { getBuzzerHistory, getBuzzerLive } from "@/lib/data/buzzer";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Buzzer" };

export default async function BuzzerAdminPage() {
  await requireAdminPage("manage");
  const [state, history] = await Promise.all([getBuzzerLive(), getBuzzerHistory(50)]);
  return (
    <>
      <PageHeader title="Buzzer" hint="run the trivia round" />
      <BuzzerDesk
        state={{
          questionNumber: state.questionNumber,
          buzzedStudentId: state.buzzedStudentId,
          buzzedStudentName: state.buzzedStudentName,
          className: state.className,
          classColor: state.classColor,
          photoUrl: state.photoUrl,
          buzzedAt: state.buzzedAt?.toISOString() ?? null,
          result: state.result,
        }}
        history={history.map((r) => ({
          id: r.id, questionNumber: r.questionNumber, studentName: r.studentName, className: r.className, classColor: r.classColor,
          result: r.result, resolvedAt: r.resolvedAt.toISOString(),
        }))}
      />
    </>
  );
}
