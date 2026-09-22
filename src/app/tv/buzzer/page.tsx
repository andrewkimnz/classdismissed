import { BuzzerBoard } from "@/components/tv/buzzer-board";
import { getBuzzerLive, getBuzzerTally } from "@/lib/data/buzzer";
import { getLiveState } from "@/lib/data/live";

export const metadata = { title: "Buzzer — display", robots: { index: false, follow: false } };

// A screen for a TV in the venue, not a signed-in person: no student or admin session, nothing to
// click. Never touches the database at build time.
export const dynamic = "force-dynamic";

export default async function TvBuzzerPage() {
  const [live, state, tally] = await Promise.all([getLiveState(), getBuzzerLive(), getBuzzerTally()]);
  return (
    <BuzzerBoard
      rev={live.rev}
      questionNumber={state.questionNumber}
      questionText={state.questionText}
      choices={state.choices}
      correctIndex={state.correctIndex}
      buzzedStudentId={state.buzzedStudentId}
      buzzedStudentName={state.buzzedStudentName}
      className={state.className}
      classColor={state.classColor}
      photoUrl={state.photoUrl}
      result={state.result}
      tally={tally}
    />
  );
}
