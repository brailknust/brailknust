import { BookX, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { knustCurricula } from "@/data/curricula";
import {
  deleteOrphanCatalogCourse,
  removeProgrammeCourse,
  restoreProgrammeCourse,
} from "@/features/admin/actions";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

function levelLabel(level: string) {
  return level.replace("LEVEL_", "Level ");
}

export default async function AdminProgrammeCatalogPage() {
  await requireAdmin();
  const [exclusions, databaseCourses] = await Promise.all([
    prisma.programmeCourseExclusion.findMany({
      include: { removedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        department: true,
        level: true,
        _count: {
          select: {
            enrollments: true,
            platformMaterials: true,
            platformTopics: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),
  ]);
  const excluded = new Map(exclusions.map((item) => [
    `${item.programme}|${item.level}|${item.semester}|${item.courseCode}`,
    item,
  ]));
  const configuredCodes = new Set(knustCurricula.flatMap((template) => template.courses.map((course) => course.code)));
  const unassignedCourses = databaseCourses.filter((course) => !configuredCodes.has(course.code));

  return (
    <AppShell title="Programme course catalog" eyebrow="Administration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <BookX className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Programme-specific courses</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          Removing a catalog course prevents it from being automatically added for future students in that programme. Existing student records are preserved.
        </p>
      </section>

      <div className="mt-6 grid gap-6">
        {knustCurricula.map((template) => (
          <section key={`${template.program}-${template.level}-${template.semester}`} className="rounded-2xl border border-border bg-white p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">{template.college}</p>
              <h2 className="mt-1 text-lg font-semibold">{template.program}</h2>
              <p className="mt-1 text-sm text-muted">{levelLabel(template.level)} · {template.semester} · {template.department}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {template.courses.map((course) => {
                const key = `${template.program}|${template.level}|${template.semester}|${course.code}`;
                const removal = excluded.get(key);
                const fields = (
                  <>
                    <input type="hidden" name="college" value={template.college} />
                    <input type="hidden" name="programme" value={template.program} />
                    <input type="hidden" name="department" value={template.department} />
                    <input type="hidden" name="level" value={template.level} />
                    <input type="hidden" name="semester" value={template.semester} />
                    <input type="hidden" name="courseCode" value={course.code} />
                  </>
                );
                return (
                  <div key={course.code} className={`flex items-center justify-between gap-4 rounded-xl border border-border p-3 ${removal ? "bg-surface opacity-70" : "bg-white"}`}>
                    <div>
                      <p className="text-sm font-semibold">{course.code} - {course.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {course.creditHours} credits
                        {removal ? ` · removed by ${removal.removedBy.fullName} on ${removal.createdAt.toLocaleDateString("en-GH")}` : ""}
                      </p>
                    </div>
                    {removal ? (
                      <form action={restoreProgrammeCourse}>
                        {fields}
                        <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold">
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </button>
                      </form>
                    ) : (
                      <form action={removeProgrammeCourse}>
                        {fields}
                        <ConfirmSubmitButton
                          message={`Remove ${course.code} from the ${template.program} catalog? Existing student records will remain.`}
                          className="h-9 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {!knustCurricula.length ? <p className="rounded-2xl border border-border p-5 text-sm text-muted">No programme curriculum templates are configured.</p> : null}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">Unassigned catalog records</h2>
          <p className="mt-1 text-sm text-muted">
            Courses stored in the database but not assigned to a configured programme curriculum.
          </p>
        </div>
        <div className="mt-4 grid gap-2">
          {unassignedCourses.length ? unassignedCourses.map((course) => {
            const hasHistory = course._count.enrollments > 0
              || course._count.platformMaterials > 0
              || course._count.platformTopics > 0;
            const codeOnly = !course.name.trim() || course.name.trim().toUpperCase() === course.code.trim().toUpperCase();
            return (
              <div key={course.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-3">
                <div>
                  <p className="text-sm font-semibold">{course.code}{codeOnly ? "" : ` - ${course.name}`}</p>
                  <p className="mt-1 text-xs text-muted">
                    {codeOnly ? "Code-only record" : "Not assigned to a programme"}
                    {course.level ? ` · ${levelLabel(course.level)}` : ""}
                    {course.department ? ` · ${course.department}` : ""}
                    {` · ${course._count.enrollments} enrollments`}
                  </p>
                </div>
                {!hasHistory ? (
                  <form action={deleteOrphanCatalogCourse}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <ConfirmSubmitButton
                      message={`Permanently delete the unassigned course ${course.code}?`}
                      className="h-9 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                ) : (
                  <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
                    In use
                  </span>
                )}
              </div>
            );
          }) : <p className="text-sm text-muted">No unassigned catalog courses.</p>}
        </div>
      </section>
    </AppShell>
  );
}
