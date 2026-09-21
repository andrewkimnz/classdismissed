"use server";

import { z } from "zod";
import { audit, run, UserError, type ActionResult } from "@/lib/actions";
import { storePhoto } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const schema = z.object({
  kind: z.enum(["student_id", "final", "class_team"]),
  targetId: z.coerce.number().int().positive(),
});

/** Upload (or replace) a photo. The browser downsizes first, but never trust that. */
export async function uploadPhoto(formData: FormData): Promise<ActionResult<{ url: string }>> {
  return run("checkin", async (ctx) => {
    const parsed = schema.safeParse({ kind: formData.get("kind"), targetId: formData.get("targetId") });
    const file = formData.get("file");
    if (!parsed.success) throw new UserError("Missing photo details.");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a photo first.");
    const ext = TYPES[file.type];
    if (!ext) throw new UserError("Photos must be JPG, PNG or WebP.");
    if (file.size > MAX_BYTES) throw new UserError("That photo is over 5 MB. Try a smaller one.");
    const { kind, targetId } = parsed.data;

    const isClass = kind === "class_team";
    const owner = isClass
      ? await ctx.sql<{ name: string }>`select name from classes where id = ${targetId}`
      : await ctx.sql<{ name: string }>`select name from students where id = ${targetId}`;
    if (!owner.length) throw new UserError("That student or class no longer exists.");

    const rel = `${isClass ? "classes" : "students"}/${targetId}/${kind}-${Date.now()}.${ext}`;
    const { url, path } = await storePhoto(rel, new Uint8Array(await file.arrayBuffer()), file.type);

    // Older uploads are kept (is_current = false) so a swap can always be undone from the DB.
    if (isClass) await ctx.sql`update photos set is_current = false where class_id = ${targetId} and kind = ${kind} and is_current`;
    else await ctx.sql`update photos set is_current = false where student_id = ${targetId} and kind = ${kind} and is_current`;
    await ctx.sql`insert into photos (kind, student_id, class_id, url, storage_path, uploaded_by)
      values (${kind}, ${isClass ? null : targetId}, ${isClass ? targetId : null}, ${url}, ${path}, ${ctx.actor.id})`;
    await audit(ctx, "photo.upload", `${kind === "class_team" ? "Team photo" : kind === "final" ? "Final photo" : "ID photo"} updated: ${owner[0].name}`, {
      entity: isClass ? "class" : "student", entityId: targetId,
    });
    return { message: `Photo saved for ${owner[0].name}.`, data: { url } };
  });
}

export async function removePhoto(input: { kind: "student_id" | "final" | "class_team"; targetId: number }): Promise<ActionResult> {
  return run("checkin", async (ctx) => {
    const isClass = input.kind === "class_team";
    if (isClass) await ctx.sql`update photos set is_current = false where class_id = ${input.targetId} and kind = ${input.kind} and is_current`;
    else await ctx.sql`update photos set is_current = false where student_id = ${input.targetId} and kind = ${input.kind} and is_current`;
    await audit(ctx, "photo.remove", `Photo removed (${input.kind})`, { entity: isClass ? "class" : "student", entityId: input.targetId });
    return { message: "Photo removed." };
  });
}
