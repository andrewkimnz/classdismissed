import { PageHeader } from "@/components/admin/ui";
import { BoundariesEditor, EventSettingsForm, TiersEditor } from "@/components/admin/settings-forms";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorld } from "@/lib/data/world";

export const metadata = { title: "Rules & settings" };

export default async function SettingsPage() {
  await requireAdminPage("manage");
  const w = await getWorld();
  const e = w.event;
  return (
    <>
      <PageHeader title="Rules & settings" hint="tune the game without touching the database" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EventSettingsForm event={{ name: e.name, tagline: e.tagline, eventDate: e.eventDate, timezone: e.timezone, venue: e.venue, assemblyPoint: e.assemblyPoint, notesRequired: e.notesRequired, principalRoom: e.principalRoom, detentionRoom: e.detentionRoom, detentionInstructions: e.detentionInstructions }} />
        </div>
        <div className="space-y-4">
          <BoundariesEditor rows={w.boundaries.map((b) => ({ grade: b.grade, minPercent: b.minPercent }))} />
          <TiersEditor tiers={w.tiers.map((t) => ({ id: t.id, name: t.name, description: t.description, icon: t.icon, successDelta: t.successDelta, failureDelta: t.failureDelta, failureDetention: t.failureDetention, enabled: t.enabled }))} />
        </div>
      </div>
    </>
  );
}
