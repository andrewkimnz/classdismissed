import { formatDateTime } from "@/lib/domain/time";
import type { DetentionRow, EventRow } from "@/lib/types";

/** Takes over the whole student app while a detention is pending. */
export function DetentionScreen({ detention, event, name }: { detention: DetentionRow; event: EventRow; name: string }) {
  const room = detention.room || event.detentionRoom;
  return (
    <div className="anim-up -mx-4 -mt-3 min-h-[calc(100dvh-64px)] bg-pen px-4 pb-10 pt-4 text-white">
      <div className="stripes-red mx-[-16px] mb-5 h-4" />
      <div className="text-center">
        <div className="pulse-ring inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white/10 text-6xl">🚨</div>
        <h1 className="display mt-3 text-[52px] leading-none drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]">DETENTION</h1>
        <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.25em] text-white/85">{name}, you have been caught</p>
      </div>

      <div className="mt-6 rounded-3xl border-4 border-white bg-white p-5 text-ink shadow-[0_6px_0_rgba(0,0,0,0.3)]">
        <div className="label">Offence</div>
        <p className="display text-2xl leading-tight">{detention.reason || "Conduct unbecoming of a KAC student"}</p>

        <div className="mt-4 rounded-2xl border-2 border-dashed border-pen bg-pen/5 p-3 text-center">
          <div className="label text-pen">Report to</div>
          <div className="display text-[40px] leading-none text-pen">ROOM {room}</div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-paper-2 px-4 py-3">
          <div>
            <div className="label">Status</div>
            <div className="display text-xl text-pen">NOT YET SERVED</div>
          </div>
          <span className="stamp text-pen text-sm">Pending</span>
        </div>
        <p className="mt-4 text-[15px] leading-snug">{event.detentionInstructions}</p>
        <p className="mt-3 text-xs text-ink-soft">Entered {formatDateTime(detention.enteredAt, event.timezone)}. An exec will mark you as served and this screen will disappear on its own.</p>
      </div>
      <div className="stripes-red mx-[-16px] mt-6 h-4" />
    </div>
  );
}
