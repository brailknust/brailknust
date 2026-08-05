import { BookX, FileUp, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { knustCurricula } from "@/data/curricula";
import {
  approveStudentCourse,
  deleteOrphanCatalogCourse,
  applyCurriculumImport,
  previewCurriculumImport,
  rejectStudentCourse,
  removeProgrammeCourse,
  rollbackCurriculumImport,
  restoreProgrammeCourse,
} from "@/features/admin/actions";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

function levelLabel(level: string) {
  return level.replace("LEVEL_", "Level ");
}

type AdminProgrammeCatalogPageProps = { searchParams: Promise<{ import?: string }> };

export default async function AdminProgrammeCatalogPage({ searchParams }: AdminProgrammeCatalogPageProps) {
  await requireAdmin();
  const [{ import: selectedImportId }, exclusions, databaseCourses, curriculumImports] = await Promise.all([
    searchParams,
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
        approvalStatus: true,
        createdBy: { select: { fullName: true, email: true } },
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
    prisma.curriculumImport.findMany({
      include: { createdBy: { select: { fullName: true } }, rows: { orderBy: { rowNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const excluded = new Map(exclusions.map((item) => [
    `${item.programme}|${item.level}|${item.semester}|${item.courseCode}`,
    item,
  ]));
  const configuredCodes = new Set(knustCurricula.flatMap((template) => template.courses.map((course) => course.code)));
  const unassignedCourses = databaseCourses.filter((course) => course.approvalStatus === "OFFICIAL" && !configuredCodes.has(course.code));
  const pendingCourses = databaseCourses.filter((course) => course.approvalStatus === "PENDING");
  const selectedImport = curriculumImports.find((item) => item.id === selectedImportId) ?? curriculumImports.find((item) => item.status === "DRAFT");

  return (
    <AppShell title="Programme course catalog" eyebrow="Administration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <BookX className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Programme-specific courses</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          Removing a catalog course prevents it from being automatically added for future students in that programme. Existing student records are preserved.
        </p>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={previewCurriculumImport} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3"><FileUp className="h-5 w-5 text-accent" /><h2 className="text-lg font-semibold">Curriculum import preview</h2></div>
          <p className="mt-2 text-sm leading-6 text-muted">Create a private preview first. Required CSV headers: courseCode, courseName, creditHours, level, term.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required name="college" placeholder="College" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input required name="department" placeholder="Department" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input required name="programme" placeholder="Programme" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <input required name="version" placeholder="Version, e.g. 2026/2027" className="h-10 rounded-lg border border-border px-3 text-sm" />
            <label className="grid gap-1 text-xs font-semibold text-muted">Duration in years<input required name="durationYears" type="number" min="1" max="6" defaultValue="4" className="h-10 rounded-lg border border-border px-3 text-sm text-foreground" /></label>
            <label className="grid gap-1 text-xs font-semibold text-muted">Terms per year<input required name="termsPerYear" type="number" min="1" max="2" defaultValue="2" className="h-10 rounded-lg border border-border px-3 text-sm text-foreground" /></label>
          </div>
          <input name="source" placeholder="Source URL or approval reference (optional)" className="mt-3 h-10 w-full rounded-lg border border-border px-3 text-sm" />
          <textarea required name="csv" rows={8} placeholder={'courseCode,courseName,creditHours,level,term\nCENG 201,Circuit Theory,3,LEVEL_200,FIRST'} className="mt-3 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs" />
          <PendingSubmitButton pendingLabel="Validating..." className="mt-3 h-10 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Preview import</PendingSubmitButton>
        </form>

        <div className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Import review</h2>
          {selectedImport ? <>
            <p className="mt-2 text-sm text-muted">{selectedImport.programme} - {selectedImport.version} by {selectedImport.createdBy.fullName}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{selectedImport.status.toLowerCase()} - {selectedImport.rows.length} rows</p>
            <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border">
              {selectedImport.rows.map((row) => <div key={row.id} className="border-b border-border px-3 py-2 text-xs last:border-b-0"><span className={row.status === "INVALID" ? "font-semibold text-red-600" : "font-semibold text-foreground"}>Row {row.rowNumber}</span>{" "}{row.courseCode ?? "No course code"} - {row.courseName ?? "No course name"}{row.error ? <p className="mt-1 text-red-600">{row.error}</p> : null}</div>)}
            </div>
            {selectedImport.status === "DRAFT" ? <form action={applyCurriculumImport} className="mt-4"><input type="hidden" name="importId" value={selectedImport.id} /><PendingSubmitButton pendingLabel="Applying..." className="h-10 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Apply published curriculum</PendingSubmitButton></form> : null}
            {selectedImport.status === "APPLIED" ? <form action={rollbackCurriculumImport} className="mt-4"><input type="hidden" name="importId" value={selectedImport.id} /><ConfirmSubmitButton titleText="Rollback curriculum import" confirmLabel="Rollback" message="Rollback deletes this published curriculum only while no student semester uses it." className="h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600">Rollback import</ConfirmSubmitButton></form> : null}
          </> : <p className="mt-3 text-sm text-muted">Preview a CSV import to review every course before publishing it.</p>}
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        {pendingCourses.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold">Student course approvals</h2>
            <p className="mt-1 text-sm text-muted">Pending courses remain visible only to their creator until approved.</p>
            <div className="mt-4 grid gap-3">
              {pendingCourses.map((course) => (
                <div key={course.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{course.code} - {course.name}</p>
                    <p className="mt-1 text-xs text-muted">Submitted by {course.createdBy?.fullName ?? "Unknown user"} · {course.createdBy?.email ?? "No email"}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveStudentCourse}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <PendingSubmitButton pendingLabel="Approving..." className="h-9 rounded-xl bg-[var(--accent-strong)] px-3 text-xs font-semibold text-white">Approve</PendingSubmitButton>
                    </form>
                    <form action={rejectStudentCourse}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <ConfirmSubmitButton message={`Reject ${course.code}? It will remain private to its creator.`} className="h-9 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600">Reject</ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
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
                        <PendingSubmitButton pendingLabel="Restoring..." className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold">
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </PendingSubmitButton>
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
