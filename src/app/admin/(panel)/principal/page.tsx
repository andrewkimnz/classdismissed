import { PrincipalDesk } from "@/components/admin/principal-desk";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAllModifications } from "@/lib/data/admin";
import { getWorld } from "@/lib/data/world";
import { principalAccess } from "@/lib/domain/principal";

export const metadata = { title: "Principal’s Office" };

export default async function PrincipalPage() {
  await requireAdminPage("principal");
  const w = await getWorld();
  const mods = await getAllModifications();
  const klass = (id: number) => w.classes.find((c) => c.id === id);

  const classes = w.classes.map((c) => {
    const a = principalAccess(w, c);
    const why = a.block === "phase" ? "The event isn't in After School." : a.block === "notes" ? `Needs ${a.needed} more Teacher's Note${a.needed === 1 ? "" : "s"}.` : null;
    return { id: c.id, name: c.name, color: c.color, members: w.students.filter((s) => s.classId === c.id).length, earned: a.earned, spent: a.spent, available: a.available, required: a.required, why };
  });

  const history = [...w.attempts].reverse().slice(0, 60).map((a) => ({
    id: a.id, classId: a.classId, className: klass(a.classId)?.name ?? "?", classColor: klass(a.classId)?.color ?? "#888888", status: a.status, outcome: a.outcome,
    tierName: a.tierName, tierIcon: a.tierIcon, delta: a.deltaApplied,
    detentions: w.detentions.filter((d) => d.attemptId === a.id && d.status !== "cancelled").length, notes: a.notes, at: (a.resolvedAt ?? a.requestedAt).toISOString(),
  }));

  return (
    <>
      <PageHeader title="Principal’s Office" hint="the whole team goes in. record what they risked and how it went." />
      <PrincipalDesk
        tiers={w.tiers.map((t) => ({ id: t.id, name: t.name, icon: t.icon, successDelta: t.successDelta, failureDelta: t.failureDelta, failureDetention: t.failureDetention, enabled: t.enabled }))}
        classes={classes}
        history={history}
        mods={mods.slice(0, 40).map((m) => ({ id: m.id, className: klass(m.classId)?.name ?? "?", delta: m.deltaPercent, reason: m.reason, at: m.createdAt.toISOString(), revoked: Boolean(m.revokedAt) }))}
        room={w.event.principalRoom}
      />
    </>
  );
}
