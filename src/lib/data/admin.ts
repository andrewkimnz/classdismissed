import { cache } from "react";
import { sql } from "@/lib/db/client";
import type { AdminRow, AuditRow, ClubRow, ModificationRow } from "@/lib/types";

/** Reads only staff should see. Never call these from student routes. */

export const getStudentCodes = cache(async () => {
  const rows = await sql<{ id: number; loginCode: string }>`select id, login_code from students`;
  return new Map(rows.map((r) => [r.id, r.loginCode]));
});

export const getAuditLog = cache(async (limit = 100) => sql<AuditRow>`select * from audit_log order by id desc limit ${limit}`);

export const getAllModifications = cache(async () =>
  sql<ModificationRow & { createdByName: string | null }>`
    select m.*, a.name as created_by_name from grade_modifications m left join admins a on a.id = m.created_by order by m.id desc`);

export const getAdmins = cache(async () => sql<AdminRow>`select id, email as username, name, role, active, last_login_at, created_at from admins order by id`);

export const getArchivedClubs = cache(async () => sql<ClubRow>`select * from clubs where archived_at is not null order by name`);

export interface RecentAward { id: number; classId: number; clubId: number | null; kind: "completion" | "bonus"; createdAt: Date; label: string; byName: string | null }

/** Recent class completions + bonus notes, newest first, with what's needed to revoke each. */
export const getRecentAwards = cache(async (limit = 25) =>
  sql<RecentAward>`
    select * from (
      select c.id, c.class_id, c.club_id, 'completion' as kind, c.created_at, cl.name as label, a.name as by_name
        from club_completions c join clubs cl on cl.id = c.club_id left join admins a on a.id = c.awarded_by
        where c.revoked_at is null
      union all
      select n.id, n.class_id, null, 'bonus', n.created_at, n.reason, a.name
        from teacher_notes n left join admins a on a.id = n.issued_by
        where n.revoked_at is null and n.club_id is null
    ) t order by created_at desc limit ${limit}`);
