"use client";

import { Flower2, House, IdCard, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Phase = "school_day" | "after_school" | "event_complete";

const NAV: Record<Phase, { href: string; label: string; icon: typeof House; big?: boolean }[]> = {
  school_day: [
    { href: "/", label: "Home", icon: House, big: true },
    { href: "/clubs", label: "Clubs", icon: Flower2 },
    { href: "/class", label: "Class", icon: Users },
    { href: "/profile", label: "Profile", icon: IdCard },
  ],
  after_school: [
    { href: "/", label: "Home", icon: House },
    { href: "/clubs", label: "Clubs", icon: Flower2, big: true },
    { href: "/class", label: "Class", icon: Users },
    { href: "/profile", label: "Profile", icon: IdCard },
  ],
  event_complete: [
    { href: "/", label: "Keepsake", icon: House, big: true },
    { href: "/class", label: "Class", icon: Users },
    { href: "/standings", label: "Standings", icon: Trophy },
    { href: "/profile", label: "Profile", icon: IdCard },
  ],
};

export function BottomNav({ phase }: { phase: Phase }) {
  const path = usePathname();
  const items = NAV[phase];
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper/95 backdrop-blur">
      <ul className="mx-auto flex max-w-[480px] items-end justify-around px-1 pt-1.5">
        {items.map(({ href, label, icon: Icon, big }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className="group flex flex-col items-center gap-0.5 py-1 text-[11px] font-extrabold">
                <span
                  className={cn(
                    "flex items-center justify-center rounded-2xl border-2 transition-transform",
                    big ? "-mt-5 h-[52px] w-[52px] shadow-[0_3px_0_var(--ink)]" : "h-9 w-12",
                    active ? "border-ink bg-accent text-white" : big ? "border-ink bg-sun text-ink" : "border-transparent text-ink-soft",
                    "group-active:scale-90",
                  )}
                >
                  <Icon size={big ? 26 : 22} strokeWidth={2.3} />
                </span>
                <span className={cn(active ? "text-ink" : "text-ink-soft")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
