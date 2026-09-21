import type { AdminRole } from "@/lib/types";

/**
 * Who can do what in the staff room. Pure (no framework imports) so it can be tested and shared.
 *
 *  admin   → everything.
 *  teacher → "game master": ONLY the four "During event" tools (score entry, Teacher's Notes,
 *            Principal's Office, Detention). Nothing else in the staff room.
 */
export type Perm = "score" | "notes" | "principal" | "detention" | "checkin" | "manage";

export const ROLE_PERMS: Record<AdminRole, readonly Perm[]> = {
  admin: ["score", "notes", "principal", "detention", "checkin", "manage"],
  teacher: ["score", "notes", "principal", "detention"],
};

export const can = (admin: { role: AdminRole }, perm: Perm) => ROLE_PERMS[admin.role].includes(perm);

/** The "During event" pages: the only ones a game master can open. Order = order in the menu. */
export const DURING_EVENT_PAGES: readonly { href: string; perm: Perm }[] = [
  { href: "/admin/scoring", perm: "score" },
  { href: "/admin/notes", perm: "notes" },
  { href: "/admin/principal", perm: "principal" },
  { href: "/admin/detention", perm: "detention" },
];

/** Where this person lands after signing in, or when they open a page they can't use. */
export function homePath(admin: { role: AdminRole }): string {
  if (can(admin, "manage")) return "/admin";
  return DURING_EVENT_PAGES.find((p) => can(admin, p.perm))?.href ?? "/admin/login";
}
