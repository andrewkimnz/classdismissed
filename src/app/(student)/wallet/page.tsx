import { Card, SectionTitle } from "@/components/ui/kit";
import { cn } from "@/lib/cn";
import { requireStudent } from "@/lib/auth/student";
import { koinBalance, koinHistory } from "@/lib/domain/koins";
import { timeAgo } from "@/lib/domain/time";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const { student, world } = await requireStudent();

  if (world.event.phase !== "after_school") {
    return (
      <div className="card bg-white p-5 text-center">
        <div className="text-4xl">🪙</div>
        <div className="display mt-1 text-2xl">Wallet</div>
        <p className="mt-1 text-sm text-ink-soft">Kaco Koins open up during Phase 2 (After School).</p>
      </div>
    );
  }

  const balance = koinBalance(world, student.id);
  const history = koinHistory(world, student.id);

  return (
    <div className="space-y-5">
      <div className="card bg-white p-6 text-center">
        <div className="label">Kaco Koins</div>
        <div className="display mt-1 text-[56px] leading-none">🪙 {balance}</div>
      </div>

      <div>
        <SectionTitle>Recent activity</SectionTitle>
        {history.length === 0 ? (
          <Card className="text-center text-sm text-ink-soft">Nothing yet — complete a club to earn your first Koins.</Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {history.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold leading-tight">{t.description}</div>
                    <div className="text-xs text-ink-soft">{timeAgo(t.createdAt)}</div>
                  </div>
                  <span className={cn("display shrink-0 text-xl tabular", t.delta > 0 ? "text-emerald-700" : "text-pen")}>
                    {t.delta > 0 ? "+" : ""}{t.delta}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
