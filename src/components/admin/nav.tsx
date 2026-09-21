"use client";

import {
  CalendarDays, Flower2, Gauge, History, Landmark, LogOut, Menu, PenLine, School, Settings, Siren, Sparkles, StickyNote, Trophy, UserCheck, UserCog, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminLogout } from "@/actions/auth";
import { Crest } from "@/components/ui/crest";
import { cn } from "@/lib/cn";
import { visibleNav } from "@/lib/admin-nav";

const ICONS: Record<string, typeof Gauge> = {
  "/admin": Gauge, "/admin/checkin": UserCheck, "/admin/scoring": PenLine, "/admin/notes": StickyNote, "/admin/principal": Landmark,
  "/admin/detention": Siren, "/admin/leaderboard": Trophy, "/admin/stats": Sparkles, "/admin/students": Users, "/admin/classes": School,
  "/admin/timetable": CalendarDays, "/admin/clubs": Flower2, "/admin/settings": Settings, "/admin/staff": UserCog, "/admin/activity": History,
};

// Mobile quick bar: the tools used all night. Admins get Control first; game masters only ever see their own four.
const QUICK = ["/admin", "/admin/scoring", "/admin/notes", "/admin/principal", "/admin/detention"] as const;

export function AdminNav({ name, role, canManage }: { name: string; role: string; canManage: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = visibleNav(canManage).map((i) => ({ ...i, icon: ICONS[i.href] }));
  const quick = QUICK.filter((href) => items.some((i) => i.href === href));
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const groups = [...new Set(items.map((i) => i.group))];

  const list = (
    <nav aria-label="Admin" className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <div className="label mb-1 px-3">{g}</div>
          <ul className="space-y-0.5">
            {items.filter((i) => i.group === g).map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)} className={cn("flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-extrabold", active(href) ? "bg-ink text-white" : "hover:bg-paper-2")}>
                  <Icon size={19} strokeWidth={2.3} /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* top bar (mobile) */}
      <header className="sticky top-0 z-40 flex items-center gap-2.5 border-b-2 border-ink bg-paper/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Crest size={26} />
        <div className="display text-lg leading-none">STAFF ROOM</div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-white"><Menu size={20} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-sm flex-col overflow-y-auto border-l-2 border-ink bg-paper p-4">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="mb-2 ml-auto rounded-full border-2 border-ink p-1.5"><X size={18} /></button>
            {list}
            <div className="mt-6 border-t-2 border-dashed border-line pt-3">
              <div className="px-3 text-sm font-bold">{name} <span className="text-ink-soft">· {role === "admin" ? "Admin" : "Game master"}</span></div>
              <form action={adminLogout}><button className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-extrabold text-pen"><LogOut size={19} /> Sign out</button></form>
            </div>
          </div>
        </div>
      )}
      {/* sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r-2 border-ink bg-paper p-4 md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-2"><Crest size={34} /><div><div className="display text-xl leading-none">STAFF ROOM</div><div className="label">KAC Academy</div></div></div>
        {list}
        <div className="mt-auto border-t-2 border-dashed border-line pt-3">
          <div className="px-3 text-sm font-bold">{name}<div className="text-xs font-semibold text-ink-soft">{role === "admin" ? "Admin" : "Game master"}</div></div>
          <form action={adminLogout}><button className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-extrabold text-pen"><LogOut size={19} /> Sign out</button></form>
        </div>
      </aside>
      {/* quick bar (mobile): the tools tapped all night */}
      <nav aria-label="Quick tools" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper/95 backdrop-blur md:hidden">
        <ul className="flex justify-around px-1 pt-1.5">
          {quick.map((href) => {
            const it = items.find((i) => i.href === href)!;
            const Icon = it.icon;
            return (
              <li key={href} className="flex-1">
                <Link href={href} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10.5px] font-extrabold", active(href) ? "text-accent" : "text-ink-soft")}>
                  <Icon size={22} strokeWidth={2.3} />
                  {it.label.replace("Teacher’s Notes", "Notes").replace("Principal’s Office", "Office").replace("Event control", "Control").replace("Score entry", "Score")}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
