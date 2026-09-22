import { BuzzerQuestionsAdmin } from "@/components/admin/buzzer-questions-admin";
import { PageHeader } from "@/components/admin/ui";
import { getBuzzerQuestions } from "@/lib/data/buzzer";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata = { title: "Buzzer questions" };

export default async function BuzzerQuestionsPage() {
  await requireAdminPage("manage");
  const questions = await getBuzzerQuestions();
  return (
    <>
      <PageHeader title="Buzzer questions" hint="prepare the trivia round" />
      <BuzzerQuestionsAdmin questions={questions.map((q) => ({ id: q.id, question: q.question, choices: q.choices, correctIndex: q.correctIndex }))} />
    </>
  );
}
