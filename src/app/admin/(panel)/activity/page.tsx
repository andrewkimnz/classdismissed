import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAuditLog } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { formatDateTime } from "@/lib/domain/time";

export const metadata = { title: "Activity log" };

export default async function ActivityPage() {
  await requireAdminPage("manage");
  const w = await getWorld();
  const log = await getAuditLog(200);
  return (
    <>
      <PageHeader title="Activity log" hint="every organiser action, newest first" />
      <Panel>
        {log.length === 0 ? <p className="text-sm text-ink-soft">Nothing recorded yet.</p> : (
          <ul className="divide-y divide-line">
            {log.map((a) => (
              <li key={a.id} className="py-2.5 text-sm">
                <div className="flex items-start justify-between gap-3"><span><b>{a.adminName}</b> · {a.summary}</span><span className="shrink-0 text-xs text-ink-soft">{formatDateTime(a.at, w.event.timezone)}</span></div>
                <div className="font-mono text-[11px] text-ink-soft">{a.action}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
