"use client";

import { useRef, useState, type ReactNode } from "react";
import { toBlob } from "html-to-image";

export interface IdCardItem {
  id: number;
  filename: string;
  node: ReactNode;
}

const PIXEL_RATIO = 3;

let warmed = false;

async function render(el: HTMLElement): Promise<Blob> {
  // The very first capture can miss fonts that haven't been inlined yet, so throw one away.
  if (!warmed) {
    await toBlob(el, { pixelRatio: 1, cacheBust: false });
    warmed = true;
  }
  const blob = await toBlob(el, { pixelRatio: PIXEL_RATIO, cacheBust: false });
  if (!blob) throw new Error("Couldn't render the card.");
  return blob;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function IdCardGallery({ items, zipName }: { items: IdCardItem[]; zipName: string }) {
  const refs = useRef(new Map<number, HTMLDivElement>());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function one(item: IdCardItem) {
    const el = refs.current.get(item.id);
    if (!el) return;
    setError(null);
    setBusy(`one-${item.id}`);
    try {
      save(await render(el), item.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  async function all() {
    setError(null);
    setBusy("all");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let done = 0;
      for (const item of items) {
        const el = refs.current.get(item.id);
        if (!el) continue;
        zip.file(item.filename, await render(el));
        setBusy(`all:${++done}`);
      }
      save(await zip.generateAsync({ type: "blob" }), zipName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  const working = busy !== null;
  const progress = busy?.startsWith("all:") ? ` ${busy.slice(4)}/${items.length}` : "";

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={working || items.length === 0} onClick={all}>
          {busy?.startsWith("all") ? `Building zip…${progress}` : `⬇ Download all ${items.length} (zip of PNGs)`}
        </button>
        {error && <span className="text-sm font-bold text-pen">⚠️ {error}</span>}
      </div>
      <div className="flex flex-wrap gap-6">
        {items.map((item) => (
          <div key={item.id} className="w-[440px] max-w-full space-y-2">
            {/* padded so the lanyard slot that overhangs the card isn't clipped in the image */}
            <div ref={(el) => { if (el) refs.current.set(item.id, el); else refs.current.delete(item.id); }} className="w-[440px] bg-paper px-5 pb-5 pt-6">
              {item.node}
            </div>
            <button className="btn btn-ghost btn-sm w-full" disabled={working} onClick={() => one(item)}>
              {busy === `one-${item.id}` ? "Rendering…" : "⬇ Download PNG"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
