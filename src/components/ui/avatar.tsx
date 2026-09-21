import { cn } from "@/lib/cn";

/* Deterministic "school ID photo day" faces for students with no upload yet.
   Deliberately awkward: off-centre, blinking, flash glare, questionable framing. */

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

const SKIN = ["#F6D5B8", "#EBC19C", "#D9A578", "#C08A5E", "#F3CBAA", "#E2B48A"];
const HAIR = ["#1B1B1F", "#2B1D16", "#4B3020", "#0F0F14", "#6B3F22", "#232338"];
const BACK = ["#BFD9FF", "#FFD3E1", "#D6F0D0", "#FFE9A8", "#E0D4FF", "#CFE8EE"];

export function FunnyAvatar({ seed, className }: { seed: number; className?: string }) {
  const r = rng(seed + 7);
  const skin = pick(r, SKIN), hair = pick(r, HAIR), back = pick(r, BACK);
  const hairStyle = Math.floor(r() * 5);
  const eyes = Math.floor(r() * 5);
  const mouth = Math.floor(r() * 5);
  const glasses = r() < 0.3, blush = r() < 0.45, tie = pick(r, ["#D8392F", "#E8628C", "#3F7CE0"]);
  const dx = (r() - 0.5) * 14, dy = (r() - 0.35) * 16, rot = (r() - 0.5) * 12, scale = 0.94 + r() * 0.22;

  const eye = (x: number) => {
    switch (eyes) {
      case 0: return <circle key={x} cx={x} cy={62} r={2.6} fill="#1b1b1f" />;
      case 1: return (<g key={x}><circle cx={x} cy={62} r={4.6} fill="#fff" stroke="#1b1b1f" strokeWidth={1} /><circle cx={x + 1.4} cy={62.6} r={2.1} fill="#1b1b1f" /></g>);
      case 2: return <path key={x} d={`M${x - 4} 62 q4 3.6 8 0`} stroke="#1b1b1f" strokeWidth={2} fill="none" strokeLinecap="round" />;
      case 3: return x < 50
        ? <circle key={x} cx={x} cy={62} r={2.6} fill="#1b1b1f" />
        : <path key={x} d={`M${x - 4} 62 q4 -3.6 8 0`} stroke="#1b1b1f" strokeWidth={2} fill="none" strokeLinecap="round" />;
      default: return (<g key={x}><circle cx={x} cy={62} r={4.2} fill="#fff" stroke="#1b1b1f" strokeWidth={1} /><circle cx={x - 1.2} cy={61} r={1.9} fill="#1b1b1f" /></g>);
    }
  };

  const mouths = [
    <path key="m" d="M40 78 q10 9 20 0" stroke="#1b1b1f" strokeWidth={2.2} fill="none" strokeLinecap="round" />,
    <ellipse key="m" cx={50} cy={79} rx={4.6} ry={5.6} fill="#5a1f2a" />,
    <g key="m"><path d="M41 77 q9 7 18 0" stroke="#1b1b1f" strokeWidth={2.2} fill="none" strokeLinecap="round" /><path d="M46 80 q4 10 8 0Z" fill="#F0668A" stroke="#1b1b1f" strokeWidth={1} /></g>,
    <path key="m" d="M41 79 h18" stroke="#1b1b1f" strokeWidth={2.4} strokeLinecap="round" />,
    <g key="m"><path d="M39 76 q11 13 22 0Z" fill="#fff" stroke="#1b1b1f" strokeWidth={1.6} strokeLinejoin="round" /><path d="M45 76v6M50 76v7M55 76v6" stroke="#1b1b1f" strokeWidth={0.8} /></g>,
  ];

  const hairBack = hairStyle === 2 ? <path d="M22 60 C20 40 30 32 50 32 C70 32 80 40 78 60 L82 96 L66 96 L66 66 L34 66 L34 96 L18 96Z" fill={hair} /> : null;
  const hairTop = [
    <path key="h" d="M24 58 C21 30 40 26 50 26 C60 26 79 30 76 58 C70 45 60 41 50 41 C40 41 30 45 24 58Z" fill={hair} />,
    <path key="h" d="M24 56 L26 34 L34 44 L40 26 L48 42 L56 24 L62 42 L72 30 L76 56 C68 44 60 42 50 42 C40 42 32 44 24 56Z" fill={hair} />,
    <path key="h" d="M24 58 C21 30 40 26 50 26 C60 26 79 30 76 58 C68 44 60 40 50 40 C40 40 32 44 24 58Z" fill={hair} />,
    <g key="h"><circle cx={50} cy={22} r={9} fill={hair} /><path d="M24 58 C22 34 40 30 50 30 C60 30 78 34 76 58 C70 46 60 42 50 42 C40 42 30 46 24 58Z" fill={hair} /></g>,
    <path key="h" d="M23 60 C20 32 42 24 56 27 C72 30 80 42 77 60 C74 48 66 44 58 42 C46 46 34 44 23 60Z" fill={hair} />,
  ][hairStyle];

  return (
    <svg viewBox="0 0 100 120" className={cn("block h-full w-full", className)} role="img" aria-label="Student ID photo" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="120" fill={back} />
      <g transform={`translate(${dx} ${dy}) rotate(${rot} 50 70) scale(${scale})`} style={{ transformOrigin: "50px 70px" }}>
        {hairBack}
        <path d="M6 128 C6 100 26 92 50 92 C74 92 94 100 94 128Z" fill="#1F2A5A" />
        <path d="M38 92 L50 110 L62 92Z" fill="#fffaf0" />
        <path d="M47 100 h6 l3 22 h-12Z" fill={tie} />
        <rect x={42} y={82} width={16} height={14} rx={5} fill={skin} />
        <ellipse cx={50} cy={64} rx={26} ry={29} fill={skin} />
        <ellipse cx={24.5} cy={66} rx={4} ry={6} fill={skin} />
        <ellipse cx={75.5} cy={66} rx={4} ry={6} fill={skin} />
        {hairTop}
        {blush && (<><ellipse cx={34} cy={72} rx={5} ry={3.2} fill="#F58FA8" opacity={0.55} /><ellipse cx={66} cy={72} rx={5} ry={3.2} fill="#F58FA8" opacity={0.55} /></>)}
        {eye(39)}
        {eye(61)}
        {glasses && (<g fill="none" stroke="#1b1b1f" strokeWidth={1.8}><circle cx={39} cy={62} r={8} /><circle cx={61} cy={62} r={8} /><path d="M47 62h6" /></g>)}
        <path d="M50 66 v6 h-3" stroke="#00000030" strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {mouths[mouth]}
        <ellipse cx={44} cy={43} rx={9} ry={5} fill="#fff" opacity={0.28} />
      </g>
    </svg>
  );
}

export interface AvatarStudent {
  id: number;
  name: string;
  photoUrl?: string | null;
}

/** Real uploaded ID photo when there is one, otherwise a suitably terrible placeholder. */
export function Avatar({ student, className }: { student: AvatarStudent; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-sky", className)}>
      {student.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={student.photoUrl} alt={`${student.name}'s ID photo`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <FunnyAvatar seed={student.id} />
      )}
    </div>
  );
}
