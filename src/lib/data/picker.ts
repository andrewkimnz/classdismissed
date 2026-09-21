import type { PickerStudent } from "@/components/admin/student-picker";
import type { World } from "@/lib/types";

/** World students → the lightweight shape the picker needs (safe to send to the browser: no login codes). */
export function pickerStudents(w: World): PickerStudent[] {
  return w.students.map((s) => {
    const k = w.classes.find((c) => c.id === s.classId);
    const detained = w.detentions.some((d) => d.studentId === s.id && d.status === "pending");
    return {
      id: s.id, name: s.name, studentNo: s.studentNo, className: k?.name ?? null, classColor: k?.color ?? null, photoUrl: s.photoUrl,
      hint: detained ? "🚨 IN DETENTION" : s.attendance === "absent" ? "absent" : s.attendance === "expected" ? "not checked in" : undefined,
      tone: detained ? "bad" : undefined,
    };
  });
}
