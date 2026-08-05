import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ListChecks, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createSemester, deleteSemester } from "@/features/academics/actions";
import { getSemesterCards } from "@/features/academics/queries";
import { requireAppUser } from "@/features/auth/queries";

const semesterOptions = ["First Semester", "Second Semester"] as const;
const levelOptions = ["LEVEL_100", "LEVEL_200", "LEVEL_300", "LEVEL_400", "LEVEL_500", "LEVEL_600"] as const;
const defaultAcademicYear = "2025/2026";
const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 7 }, (_, index) => {
  const startYear = currentYear - 2 + index;
  return `${startYear}/${startYear + 1}`;
});

function formatCwa(value: unknown) {
  return value ? `${value.toString()}%` : "Not set";
}

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Level not set";
}

export default async function AcademicsPage() {
  const { appUser } = await requireAppUser();
  const semesters = await getSemesterCards(appUser.id);
  const usedSlots = new Set(semesters.map((semester) => `${semester.level}|${semester.name}`));
  const availableSlots = levelOptions.flatMap((level) => semesterOptions.map((name) => ({ level, name }))).filter((slot) => !usedSlots.has(`${slot.level}|${slot.name}`));

  return (
    <AppShell title="Academic semesters" eyebrow="Academics">
      <section className="rounded-2xl border border-border bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
              Semester workspace
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Manage each semester as its own card.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Open a semester to update its CWA, enroll courses, manage timetable blocks, and
              drill into per-course analytics.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <CalendarDays className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">{semesters.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Semesters
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <BookOpen className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">
                {semesters.reduce((total, semester) => total + semester.enrollments.length, 0)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Enrollments
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <ListChecks className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">
                {semesters.reduce((total, semester) => total + semester.openTaskCount, 0)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Open tasks
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <form action={createSemester} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Add semester</h2>
          </div>
          <div className="mt-5 grid gap-4">
            {availableSlots.length ? (
              <select name="slot" required defaultValue={availableSlots[0] ? `${availableSlots[0].level}|${availableSlots[0].name}` : ""} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
                {availableSlots.map((slot) => (
                  <option key={`${slot.level}|${slot.name}`} value={`${slot.level}|${slot.name}`}>
                    {formatLevel(slot.level)} - {slot.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">All available semester slots have been created.</p>
            )}
            <select
              name="academicYear"
              required
              defaultValue={defaultAcademicYear}
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
            >
              {academicYearOptions.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Start date
                <input
                  name="startDate"
                  type="date"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                End date
                <input
                  name="endDate"
                  type="date"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-muted">
              <input name="isActive" type="checkbox" className="h-4 w-4" />
              Set as active semester
            </label>
            <PendingSubmitButton disabled={!availableSlots.length} pendingLabel="Saving semester..." className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Save semester
            </PendingSubmitButton>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          {semesters.length ? (
            semesters.map((semester) => (
              <article
                key={semester.id}
                className="rounded-2xl border border-border bg-white p-5 transition hover:border-foreground"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                      {semester.academicYear}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold">
                      {formatLevel(semester.level)} - {semester.name}
                    </h2>
                  </div>
                  {semester.isActiveForUser ? (
                    <span className="rounded-xl bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white">
                      Active
                    </span>
                  ) : null}
                  {semester.isArchived ? (
                    <span className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted">
                      Archived
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">CWA</p>
                    <p className="mt-2 font-semibold">{formatCwa(semester.cwa)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Courses
                    </p>
                    <p className="mt-2 font-semibold">{semester.enrollments.length}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                      Tasks
                    </p>
                    <p className="mt-2 font-semibold">{semester.openTaskCount}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/academics/semesters/${semester.id}`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white"
                  >
                    Open semester
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <form action={deleteSemester}>
                    <input type="hidden" name="semesterId" value={semester.id} />
                    <ConfirmSubmitButton
                      message={`Delete ${formatLevel(semester.level)} - ${semester.name}? This removes the semester from your workspace.`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-border bg-white p-5 text-sm text-muted">
              No semesters yet. Create your first semester to begin.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}



