import { DURING_EVENT_PAGES } from "@/lib/auth/permissions";

export const DURING_EVENT = "During event";

/** Staff-room menu structure (icons are added in components/admin/nav.tsx). Game masters see only "During event". */
export const ADMIN_NAV: { href: string; label: string; group: string }[] = [
  { href: "/admin", label: "Event control", group: "Run the night" },
  { href: "/admin/checkin", label: "Check-in", group: "Run the night" },
  { href: "/admin/scoring", label: "Score entry", group: DURING_EVENT },
  { href: "/admin/notes", label: "Teacher’s Notes", group: DURING_EVENT },
  { href: "/admin/principal", label: "Principal’s Office", group: DURING_EVENT },
  { href: "/admin/detention", label: "Detention", group: DURING_EVENT },
  { href: "/admin/leaderboard", label: "Leaderboard", group: "Results" },
  { href: "/admin/stats", label: "Final stats", group: "Results" },
  { href: "/admin/students", label: "Students", group: "Set up" },
  { href: "/admin/classes", label: "Classes", group: "Set up" },
  { href: "/admin/timetable", label: "Timetable & subjects", group: "Set up" },
  { href: "/admin/clubs", label: "Clubs", group: "Set up" },
  { href: "/admin/settings", label: "Rules & settings", group: "Set up" },
  { href: "/admin/staff", label: "Staff accounts", group: "Set up" },
  { href: "/admin/activity", label: "Activity log", group: "Set up" },
];

/** The menu entries this role may see. */
export const visibleNav = (canManage: boolean) => ADMIN_NAV.filter((i) => canManage || i.group === DURING_EVENT);

// The "During event" group must be exactly the pages game masters can open (checked in tests too).
export const DURING_EVENT_HREFS = DURING_EVENT_PAGES.map((p) => p.href);
