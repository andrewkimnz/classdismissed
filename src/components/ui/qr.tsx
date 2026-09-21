import QRCode from "qrcode";

/** Server-rendered QR (SVG). The SVG string is generated here from our own value, never from user HTML. */
export async function QrCode({ value, className }: { value: string; className?: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1e2a4a", light: "#ffffff" } });
  return <div className={className} aria-label={`QR code for ${value}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />;
}
