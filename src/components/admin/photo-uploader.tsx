"use client";

import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { removePhoto, uploadPhoto } from "@/actions/photos";
import { Avatar } from "@/components/ui/avatar";
import { useAct, useToast } from "./ui";

/** Shrinks a phone photo to ≤1100px JPEG in the browser: ~150 KB instead of 6 MB, so it uploads fast on bad Wi-Fi. */
async function downscale(file: File, max = 1100, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

export function PhotoUploader({
  kind, targetId, name, currentUrl, seedId, aspect = "portrait", label,
}: {
  kind: "student_id" | "final" | "class_team"; targetId: number; name: string; currentUrl: string | null; seedId?: number; aspect?: "portrait" | "landscape"; label?: string;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { act, pending } = useAct();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("targetId", String(targetId));
      fd.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const r = await uploadPhoto(fd);
      toast(r.ok, r.ok ? (r.message ?? "Photo saved.") : r.error);
    } catch {
      toast(false, "Couldn't upload that photo. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (gallery.current) gallery.current.value = "";
    }
  }

  const working = busy || pending;
  return (
    <div className="flex items-center gap-3">
      <Avatar
        student={{ id: seedId ?? targetId, name, photoUrl: currentUrl }}
        className={aspect === "portrait" ? "h-28 w-24 shrink-0 rounded-xl border-2 border-ink" : "h-24 w-32 shrink-0 rounded-xl border-2 border-ink"}
      />
      <div className="min-w-0 space-y-2">
        {label && <div className="label">{label}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sun btn-sm" disabled={working} onClick={() => camera.current?.click()}><Camera size={16} /> {working ? "Uploading…" : "Take photo"}</button>
          <button type="button" className="btn btn-sm" disabled={working} onClick={() => gallery.current?.click()}><ImagePlus size={16} /> Choose</button>
          {currentUrl && <button type="button" aria-label="Remove photo" className="btn btn-ghost btn-sm" disabled={working} onClick={() => act(() => removePhoto({ kind, targetId }))}><Trash2 size={16} /></button>}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
