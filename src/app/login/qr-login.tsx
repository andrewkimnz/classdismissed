"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { codeFromScan } from "@/lib/auth/scan";

type Status = "starting" | "scanning" | "signing-in" | "error";

/** "Scan my QR card": opens the camera; a valid card QR signs the student straight in. */
export function QrLogin() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-sun btn-lg w-full" onClick={() => setOpen(true)}>
        <Camera size={24} /> Scan my QR card
      </button>
      {open && <ScannerOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

function ScannerOverlay({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    let scanner: { start(): Promise<void>; stop(): void; destroy(): void } | undefined;
    let cancelled = false;

    const fail = (text: string) => {
      setStatus("error");
      setMessage(text);
    };

    (async () => {
      // Browsers only allow the camera on https pages (localhost counts as secure).
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        return fail("Your browser only allows the camera on secure (https) pages. Type the code from your card instead.");
      }
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !video.current) return;
        if (!(await QrScanner.hasCamera())) return fail("No camera found on this device. Type the code from your card instead.");
        scanner = new QrScanner(
          video.current,
          (result: { data: string }) => {
            if (handled.current) return;
            const code = codeFromScan(result.data);
            if (!code) {
              setMessage("That QR isn't a KAC student card. Try your card again.");
              return;
            }
            handled.current = true;
            setStatus("signing-in");
            scanner?.stop();
            // /l/CODE checks the code, signs in, and lands on Home. A wrong code returns here with a message.
            window.location.assign(`/l/${encodeURIComponent(code)}`);
          },
          { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: "environment", maxScansPerSecond: 10 },
        );
        await scanner.start();
        if (!cancelled) setStatus("scanning");
      } catch (e) {
        const denied = e instanceof Error && /permission|denied|notallowed/i.test(`${e.name} ${e.message}`);
        fail(denied ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the code from your card." : "Couldn't open the camera. Type the code from your card instead.");
      }
    })();

    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan your QR card" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink/95 px-5 text-white">
      <button onClick={onClose} aria-label="Close camera" className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] rounded-full border-2 border-white/70 p-2"><X size={22} /></button>
      <h2 className="display text-3xl">Scan your card</h2>
      <p className="mb-4 mt-1 max-w-xs text-center text-sm text-white/80">Hold the QR code on your student card inside the square.</p>

      {status !== "error" ? (
        <div className="relative aspect-square w-full max-w-[340px] overflow-hidden rounded-3xl border-4 border-sun bg-black">
          <video ref={video} className="h-full w-full object-cover" playsInline muted />
          {status !== "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-extrabold">{status === "signing-in" ? "Signing you in…" : "Starting camera…"}</div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-[340px] rounded-3xl border-4 border-sun bg-white p-5 text-center text-ink">
          <div className="text-4xl">📷</div>
          <p role="alert" className="mt-2 text-[15px] font-bold">{message}</p>
        </div>
      )}
      {status === "scanning" && message && <p role="status" className="mt-3 rounded-xl bg-pen px-3 py-1.5 text-sm font-bold">{message}</p>}
      <button onClick={onClose} className="btn btn-ghost mt-6 !border-white/60 !text-white">Type my code instead</button>
    </div>
  );
}
