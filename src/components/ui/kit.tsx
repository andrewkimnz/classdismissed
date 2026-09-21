import Link from "next/link";
import type { ReactNode } from "react";
import { cn, readableOn } from "@/lib/cn";

/** Little labelled pill: statuses, counts, tags. */
export function Chip({
  children, tone = "ink", className,
}: { children: ReactNode; tone?: "ink" | "good" | "warn" | "bad" | "accent" | "soft" | "sun"; className?: string }) {
  const tones = {
    ink: "bg-ink text-white",
    good: "bg-mint text-ink",
    warn: "bg-sun text-ink",
    bad: "bg-pen text-white",
    accent: "bg-accent text-white",
    soft: "bg-paper-2 text-ink border border-line",
    sun: "bg-sun text-ink",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ClassBadge({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-extrabold tracking-wide", className)}
      style={{ background: color, color: readableOn(color) }}
    >
      {name}
    </span>
  );
}

export function Card({ children, className, soft }: { children: ReactNode; className?: string; soft?: boolean }) {
  return <section className={cn(soft ? "card-soft" : "card", "p-4", className)}>{children}</section>;
}

export function SectionTitle({ children, hint, right }: { children: ReactNode; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 px-1">
      <div>
        <h2 className="display text-[22px] leading-tight">{children}</h2>
        {hint && <p className="hand -mt-0.5 text-lg leading-tight text-sakura-deep">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

type BtnVariant = "primary" | "sun" | "ink" | "danger" | "good" | "ghost" | "plain";
export function btnClass(variant: BtnVariant = "plain", size: "sm" | "md" | "lg" = "md", extra?: string) {
  return cn(
    "btn",
    variant === "primary" && "btn-primary",
    variant === "sun" && "btn-sun",
    variant === "ink" && "btn-ink",
    variant === "danger" && "btn-danger",
    variant === "good" && "btn-good",
    variant === "ghost" && "btn-ghost",
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    extra,
  );
}

export function LinkButton({
  href, children, variant = "plain", size = "md", className,
}: { href: string; children: ReactNode; variant?: BtnVariant; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Link href={href} className={btnClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Empty({ emoji = "🌸", title, children }: { emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line bg-white/60 px-5 py-8 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="display mt-2 text-xl">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

/** A score-style progress bar: raw over max. */
export function Meter({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2 ring-1 ring-line">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Falling sakura petals: pure CSS, decorative, hidden from assistive tech. */
export function Petals({ count = 14 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37 + 11) % 100;
        const size = 8 + ((i * 7) % 9);
        const dur = 9 + ((i * 5) % 8);
        const delay = -((i * 3) % dur);
        return (
          <span
            key={i}
            className="absolute top-0 block rounded-[60%_40%_60%_40%] bg-sakura"
            style={{
              left: `${left}%`, width: size, height: size * 0.8, opacity: 0.8,
              animation: `petal-fall ${dur}s linear ${delay}s infinite`,
              ["--drift" as string]: `${(i % 2 ? 1 : -1) * (30 + (i * 13) % 60)}px`,
            }}
          />
        );
      })}
    </div>
  );
}
