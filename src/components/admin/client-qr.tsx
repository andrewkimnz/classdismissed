"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Browser-side QR, for values only known after a tap (a freshly chosen student's login link). */
export function ClientQr({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#1e2a4a", light: "#ffffff" } }).then((u) => live && setSrc(u));
    return () => { live = false; };
  }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR code" width={size} height={size} className={className} /> : <div style={{ width: size, height: size }} className={className} />;
}
