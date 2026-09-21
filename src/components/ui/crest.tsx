/**
 * The KAC Academy crest: navy shield, open book, and the KAC dragon mascot
 * (public/kac-dragon.png). Every ID card, header, login card and keepsake uses this
 * one component, so a change here changes it everywhere.
 */
export function Crest({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  const fill = mono ? "currentColor" : "#1F2A5A";
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 64 72" role="img" aria-label="KAC Academy crest">
      <path d="M32 3 6 11v22c0 17 11 30 26 36 15-6 26-19 26-36V11Z" fill={fill} stroke={mono ? "currentColor" : "#FFD54A"} strokeWidth="3" strokeLinejoin="round" />
      {/* open book */}
      <path d="M14 40c6-3 12-3 18 1 6-4 12-4 18-1v10c-6-3-12-3-18 1-6-4-12-4-18-1Z" fill="#fffaf0" opacity={mono ? 0.9 : 1} />
      <path d="M32 41v10" stroke={fill} strokeWidth="1.5" />
      {/* the KAC dragon (public/kac-dragon.png, 256×227) sits where the blossom used to be */}
      <image href="/kac-dragon.png" x="18" y="11" width="28" height="24.8" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`display leading-none ${light ? "text-white" : "text-ink"}`}>
      KAC <span className="text-dragon-outline">ACADEMY</span>
    </span>
  );
}
