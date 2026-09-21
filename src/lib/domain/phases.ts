import type { Phase } from "@/lib/types";

export const PHASES: { key: Phase; label: string; blurb: string }[] = [
  { key: "school_day", label: "School Day", blurb: "Classes rotate through subjects." },
  { key: "after_school", label: "After School", blurb: "Clubs, Teacher's Notes and the Principal's Office." },
  { key: "event_complete", label: "Event Complete", blurb: "Final grades and keepsakes." },
];

export const phaseLabel = (p: Phase) => PHASES.find((x) => x.key === p)?.label ?? p;
export const phaseIndex = (p: Phase) => PHASES.findIndex((x) => x.key === p);
export const isPhase = (v: unknown): v is Phase => PHASES.some((p) => p.key === v);
