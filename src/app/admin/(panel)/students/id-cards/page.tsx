import Link from "next/link";
import { IdCardGallery } from "@/components/admin/id-card-gallery";
import { IdCard } from "@/components/student/id-card";
import { requireAdminPage } from "@/lib/auth/admin";
import { studentTag } from "@/lib/auth/codes";
import { getWorld } from "@/lib/data/world";
import { hasGrade } from "@/lib/domain/grades";
import { phaseLabel } from "@/lib/domain/phases";
import { buildStudentView } from "@/lib/domain/student-view";

export const metadata = { title: "ID card images" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every student's digital ID, rendered exactly as they see it, ready to save as PNGs. */
export default async function IdCardImagesPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireAdminPage("manage");
  const { class: classFilter } = await searchParams;
  const w = await getWorld();
  const students = w.students.filter((s) => !classFilter || String(s.classId) === classFilter);
  const items = students.map((s) => {
    const v = buildStudentView(w, s);
    return {
      id: s.id,
      filename: `${studentTag(s.studentNo)}-${slug(s.name)}.png`,
      node: <IdCard student={s} klass={v.klass} phaseLabel={phaseLabel(w.event.phase)} grade={v.result && hasGrade(v.result) ? v.result.currentGrade : null} />,
    };
  });
  const className = w.classes.find((c) => String(c.id) === classFilter)?.name;
  const pill = (active: boolean) => `rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold ${active ? "bg-ink text-white" : "bg-white"}`;
  return (
    <>
      <div className="mb-4">
        <Link href="/admin/students" className="text-sm font-extrabold text-accent">← Students</Link>
        <h1 className="display text-3xl">ID card images</h1>
        <p className="text-sm text-ink-soft">{students.length} cards, drawn as each student sees theirs (photo, class, attendance, current grade). Download one, or all as a zip.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link href="/admin/students/id-cards" className={pill(!classFilter)}>All</Link>
          {w.classes.map((c) => <Link key={c.id} href={`/admin/students/id-cards?class=${c.id}`} className={pill(classFilter === String(c.id))}>{c.name}</Link>)}
        </div>
      </div>
      <IdCardGallery items={items} zipName={`kac-student-ids${className ? `-class-${slug(className)}` : ""}.zip`} />
    </>
  );
}
