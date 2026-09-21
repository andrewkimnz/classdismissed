import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db/client";
import { getWorld } from "@/lib/data/world";
import type { StudentRow, World } from "@/lib/types";
import { STUDENT_COOKIE, verifySession } from "./session";

/** The signed-in student's id, or null. The cookie is checked against session_version in the DB. */
export const getStudentId = cache(async (): Promise<number | null> => {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  const payload = verifySession(token, "s");
  if (!payload) return null;
  const rows = await sql<{ sessionVersion: number }>`select session_version from students where id = ${payload.id}`;
  return rows[0] && rows[0].sessionVersion === payload.v ? payload.id : null;
});

export interface StudentContext {
  student: StudentRow;
  world: World;
}

/** For student pages: returns the student + world, or sends them to /login. */
export async function requireStudent(): Promise<StudentContext> {
  const id = await getStudentId();
  if (id === null) redirect("/login");
  const world = await getWorld();
  const student = world.students.find((s) => s.id === id);
  if (!student) redirect("/login");
  return { student, world };
}
