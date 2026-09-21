import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LockedScreen } from "@/components/student/parts";
import { Chip } from "@/components/ui/kit";
import { requireStudent } from "@/lib/auth/student";
import { readableOn } from "@/lib/cn";

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, world } = await requireStudent();
  if (world.event.phase !== "after_school") return <LockedScreen title="Not open right now">Clubs are only open during After School.</LockedScreen>;
  const club = world.clubs.find((c) => c.id === Number(id));
  if (!club) notFound();
  const done = world.completions.some((c) => c.classId === student.classId && c.clubId === club.id);
  return (
    <div className="space-y-4">
      <Link href="/clubs" className="inline-flex items-center gap-1 text-sm font-extrabold text-accent"><ChevronLeft size={18} /> All clubs</Link>
      <div className="card relative overflow-hidden bg-white">
        <div className="flex h-36 items-center justify-center text-[80px]" style={{ background: club.color, color: readableOn(club.color) }}>
          {club.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            club.icon
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {club.isOpen ? <Chip tone="good">Open</Chip> : <Chip tone="soft">Closed</Chip>}
            {club.awardsNote ? <Chip tone="sun">📝 Earns a Teacher&rsquo;s Note</Chip> : <Chip tone="soft">Just for fun</Chip>}
            {done && <Chip tone="good">Your class has done this ✓</Chip>}
          </div>
          <h1 className="display text-[34px] leading-none">{club.name}</h1>
          <div className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-sun px-3 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest">Find it in</span>
            <span className="display text-xl">Room {club.room || "TBC"}</span>
          </div>
          {club.description && <p className="text-[16px] leading-snug">{club.description}</p>}
        </div>
      </div>
      {club.instructions && (
        <div className="relative rotate-[-1deg] rounded-md bg-[#fff6a8] p-4 pt-5 shadow-[0_4px_10px_rgba(30,42,74,0.2)]">
          <span className="tape -top-2 left-6 rotate-[-4deg]" />
          <div className="label mb-1 text-ink/70">How to complete it</div>
          <p className="hand text-[26px] leading-[1.05]">{club.instructions}</p>
          {club.awardsNote && <p className="mt-2 text-[13px] font-bold text-ink/70">Finish, then show an exec and they&rsquo;ll stamp your Teacher&rsquo;s Note.</p>}
        </div>
      )}
      {!club.isOpen && <p className="rounded-xl border-2 border-dashed border-line bg-white/70 p-3 text-center text-sm font-bold text-ink-soft">This club is closed right now. Try another one and come back!</p>}
    </div>
  );
}
