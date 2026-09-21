"use client";

import { useRef, useState } from "react";
import { createClub, setClubArchived, setClubOpen, updateClub, uploadClubImage } from "@/actions/clubs";
import { ConfirmButton, Field, Modal, Panel, Switch, useAct, useToast } from "@/components/admin/ui";
import { Chip } from "@/components/ui/kit";
import { cn, readableOn } from "@/lib/cn";

interface Club { id: number; name: string; icon: string; color: string; imageUrl: string | null; description: string; instructions: string; room: string; isOpen: boolean; awardsNote: boolean; completions: number }

export function ClubsAdmin({ clubs, archived, canManage }: { clubs: Club[]; archived: { id: number; name: string; icon: string }[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Club | "new" | null>(null);
  const { act, pending } = useAct();
  return (
    <>
      {canManage && <div className="mb-3 text-right"><button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>+ Add club</button></div>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {clubs.map((c) => (
          <li key={c.id} className="card overflow-hidden bg-white">
            <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: c.color, color: readableOn(c.color) }}>
              <span className="text-3xl">{c.icon}</span>
              <div className="min-w-0 flex-1"><div className="display truncate text-xl leading-tight">{c.name}</div><div className="text-xs font-extrabold opacity-80">Room {c.room || "TBC"}</div></div>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between"><span className="font-extrabold">{c.isOpen ? "Open" : "Closed"}</span><Switch label={`${c.name} open`} checked={c.isOpen} disabled={pending} onChange={(open) => act(() => setClubOpen({ id: c.id, open }))} /></div>
              <div className="flex flex-wrap gap-1.5">{c.awardsNote ? <Chip tone="sun">📝 gives a note</Chip> : <Chip tone="soft">no note</Chip>}<Chip tone="soft">✓ {c.completions} done</Chip></div>
              {canManage && <div className="flex gap-2 pt-1"><button className="btn btn-sm flex-1" onClick={() => setEditing(c)}>Edit</button><ConfirmButton size="sm" variant="ghost" confirmLabel="Remove club?" disabled={pending} onConfirm={() => act(() => setClubArchived({ id: c.id, archived: true }))}>Remove</ConfirmButton></div>}
            </div>
          </li>
        ))}
      </ul>
      {archived.length > 0 && canManage && (
        <Panel title="Removed clubs" className="mt-5"><ul className="space-y-1.5">{archived.map((a) => <li key={a.id} className="flex items-center justify-between text-sm font-bold"><span>{a.icon} {a.name}</span><button className="btn btn-sm" disabled={pending} onClick={() => act(() => setClubArchived({ id: a.id, archived: false }))}>Restore</button></li>)}</ul></Panel>
      )}
      {editing && <ClubModal key={editing === "new" ? "new" : editing.id} club={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const SWATCHES = ["#F8B4C8", "#FFD54A", "#7BD3A0", "#9CC8FF", "#C9B3FF", "#FFB88C", "#FF9AA2", "#FFC6E0"];

function ClubModal({ club, onClose }: { club: Club | null; onClose: () => void }) {
  const { act, pending } = useAct();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ name: club?.name ?? "", icon: club?.icon ?? "🎒", color: club?.color ?? SWATCHES[0], imageUrl: club?.imageUrl ?? "", description: club?.description ?? "", instructions: club?.instructions ?? "", room: club?.room ?? "", isOpen: club?.isOpen ?? true, awardsNote: club?.awardsNote ?? true });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={club ? `Edit ${club.name}` : "Add a club"}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => (club ? updateClub({ id: club.id, ...f }) : createClub(f)), { onOk: onClose }); }}>
        <div className="grid grid-cols-[80px_1fr] gap-3"><Field label="Icon"><input className="field text-center text-2xl" value={f.icon} onChange={set("icon")} maxLength={8} /></Field><Field label="Club name"><input className="field" value={f.name} onChange={set("name")} required maxLength={60} autoFocus /></Field></div>
        <Field label="Room"><input className="field font-mono" value={f.room} onChange={set("room")} placeholder="201-317" maxLength={40} /></Field>
        <Field label="Poster colour"><div className="flex flex-wrap gap-2">{SWATCHES.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setF((s) => ({ ...s, color: c }))} className="h-9 w-9 rounded-full border-2 border-ink" style={{ background: c, outline: f.color === c ? "3px solid var(--ink)" : "none", outlineOffset: 2 }} />)}</div></Field>
        <Field label="Description (what it is)"><textarea className="field" value={f.description} onChange={set("description")} maxLength={600} /></Field>
        <Field label="Activity instructions (how to earn the note)"><textarea className="field" value={f.instructions} onChange={set("instructions")} maxLength={800} /></Field>
        <Field label="Poster image (optional)" hint="Replaces the emoji on the club card.">
          <div className="flex gap-2"><input className="field flex-1" value={f.imageUrl} onChange={set("imageUrl")} placeholder="https://… or upload →" />{club && (<><button type="button" className="btn btn-sm self-center" onClick={() => file.current?.click()}>Upload</button><input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const fl = e.target.files?.[0]; if (!fl) return; const fd = new FormData(); fd.set("id", String(club.id)); fd.set("file", fl); const r = await uploadClubImage(fd); toast(r.ok, r.ok ? "Image saved." : r.error); if (r.ok && r.data) setF((s) => ({ ...s, imageUrl: r.data!.url })); }} /></>)}</div>
        </Field>
        <div className="divide-y-2 divide-dashed divide-line rounded-xl border-2 border-line bg-white px-3">
          <div className="flex items-center justify-between py-2.5"><div><div className="font-extrabold">Open</div><div className="text-xs text-ink-soft">Closed clubs stay visible but say “closed”.</div></div><Switch label="Open" checked={f.isOpen} onChange={(isOpen) => setF((s) => ({ ...s, isOpen }))} /></div>
          <div className="flex items-center justify-between py-2.5"><div><div className="font-extrabold">Awards a Teacher’s Note</div><div className="text-xs text-ink-soft">Off = completing it is just for fun.</div></div><Switch label="Awards a note" checked={f.awardsNote} onChange={(awardsNote) => setF((s) => ({ ...s, awardsNote }))} /></div>
        </div>
        <button className={cn("btn btn-primary w-full")} disabled={pending || !f.name.trim()}>{club ? "Save club" : "Create club"}</button>
      </form>
    </Modal>
  );
}
