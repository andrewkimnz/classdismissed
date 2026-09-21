import { sql } from "@/lib/db/client";

/** The heartbeat: ticks whenever anything a student can see changes. */
export async function getLiveState(): Promise<{ rev: number; phase: string }> {
  const rows = await sql<{ rev: number; phase: string }>`
    select l.rev, e.phase from live_state l, events e where l.id = 1 and e.id = 1`;
  return rows[0] ?? { rev: 0, phase: "school_day" };
}
