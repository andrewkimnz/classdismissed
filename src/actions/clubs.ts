"use server";

import { z } from "zod";
import { audit, parse, run, UserError, type ActionResult } from "@/lib/actions";
import { storePhoto } from "@/lib/storage";

const clubSchema = z.object({
  name: z.string().trim().min(1, "Club name is required").max(60),
  icon: z.string().trim().min(1, "Pick an emoji").max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  imageUrl: z.string().trim().max(500),
  description: z.string().trim().max(600),
  instructions: z.string().trim().max(800),
  room: z.string().trim().max(40),
  isOpen: z.boolean(),
  awardsNote: z.boolean(),
});
type ClubInput = z.input<typeof clubSchema>;

export async function createClub(input: ClubInput): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(clubSchema, input);
    await ctx.sql`
      insert into clubs (name, icon, color, image_url, description, instructions, room, is_open, awards_note, sort_order)
      values (${v.name}, ${v.icon}, ${v.color}, ${v.imageUrl || null}, ${v.description}, ${v.instructions}, ${v.room}, ${v.isOpen}, ${v.awardsNote},
              (select coalesce(max(sort_order), 0) + 1 from clubs))`;
    await audit(ctx, "club.create", `Created club ${v.name}`);
    return { message: `${v.name} created.` };
  });
}

export async function updateClub(input: ClubInput & { id: number }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(clubSchema.extend({ id: z.number().int().positive() }), input);
    const rows = await ctx.sql`
      update clubs set name = ${v.name}, icon = ${v.icon}, color = ${v.color}, image_url = ${v.imageUrl || null}, description = ${v.description},
        instructions = ${v.instructions}, room = ${v.room}, is_open = ${v.isOpen}, awards_note = ${v.awardsNote}
      where id = ${v.id} returning id`;
    if (!rows.length) throw new UserError("That club no longer exists.");
    await audit(ctx, "club.update", `Updated club ${v.name}`, { entity: "club", entityId: v.id, data: v });
    return { message: `${v.name} saved.` };
  });
}

/** Open / close one club. Admin only. */
export async function setClubOpen(input: { id: number; open: boolean }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id: z.number().int().positive(), open: z.boolean() }), input);
    const rows = await ctx.sql<{ name: string }>`update clubs set is_open = ${v.open} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That club no longer exists.");
    await audit(ctx, "club.open", `${rows[0].name} ${v.open ? "opened" : "closed"}`, { entity: "club", entityId: v.id });
    return { message: `${rows[0].name} is ${v.open ? "open" : "closed"}.` };
  });
}

/** "Removing" a club hides it from students but keeps every note ever awarded. Restore any time. */
export async function setClubArchived(input: { id: number; archived: boolean }): Promise<ActionResult> {
  return run("manage", async (ctx) => {
    const v = parse(z.object({ id: z.number().int().positive(), archived: z.boolean() }), input);
    const rows = await ctx.sql<{ name: string }>`
      update clubs set archived_at = ${v.archived ? new Date() : null} where id = ${v.id} returning name`;
    if (!rows.length) throw new UserError("That club no longer exists.");
    await audit(ctx, "club.archive", `${rows[0].name} ${v.archived ? "removed" : "restored"}`, { entity: "club", entityId: v.id });
    return { message: v.archived ? `${rows[0].name} removed from the student app. Notes already awarded are kept.` : `${rows[0].name} restored.` };
  });
}

export async function uploadClubImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return run("manage", async (ctx) => {
    const id = Number(formData.get("id"));
    const file = formData.get("file");
    if (!Number.isInteger(id) || !(file instanceof File) || file.size === 0) throw new UserError("Choose an image first.");
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
    if (!ext) throw new UserError("Images must be JPG, PNG or WebP.");
    if (file.size > 5 * 1024 * 1024) throw new UserError("That image is over 5 MB.");
    const { url } = await storePhoto(`clubs/${id}/${Date.now()}.${ext}`, new Uint8Array(await file.arrayBuffer()), file.type);
    const rows = await ctx.sql<{ name: string }>`update clubs set image_url = ${url} where id = ${id} returning name`;
    if (!rows.length) throw new UserError("That club no longer exists.");
    await audit(ctx, "club.image", `New image for ${rows[0].name}`, { entity: "club", entityId: id });
    return { message: "Image saved.", data: { url } };
  });
}
