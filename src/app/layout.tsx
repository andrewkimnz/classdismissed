import type { Metadata, Viewport } from "next";
import { Caveat, Jua, Nunito } from "next/font/google";
import "./globals.css";

const jua = Jua({ weight: "400", subsets: ["latin"], variable: "--font-jua", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "KAC Academy", template: "%s · KAC Academy" },
  description: "KAC Presents: Class Dismissed. The official student portal.",
  applicationName: "KAC Academy",
  appleWebApp: { capable: true, title: "KAC Academy", statusBarStyle: "default" },
  robots: { index: false, follow: false },
  // The palette is a deliberate light theme. This opts out of Dark Reader, whose injected
  // inline styles also trigger React hydration warnings in dev.
  other: { "darkreader-lock": "" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf0",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jua.variable} ${nunito.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
