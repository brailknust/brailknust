import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ListChecks } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { deleteSemester } from "@/features/academics/actions";
import { getSemesterCards } from "@/features/academics/queries";
import { requireAppUser } from "@/features/auth/queries";
import { provisionExistingUserCurriculum } from "@/features/profile/actions";

function formatCwa(value: unknown) {
  return value ? `${value.toString()}%` : "Not set";
}

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Level not set";
}

export default async function AcademicsPage() {
  const { appUser } = await requireAppUser();
  const semesters = await getSemesterCards(appUser.id);
  const hasProvisionedCurriculum = semesters.some((semester) => !semester.isCustom && semester.curriculumId);
  const curriculumSemesters = semesters.filter((semester) => !semester.isCustom && semester.curriculumId);
  const customSemesters = semesters.filter((semester) => semester.isCustom || !semester.curriculumId);

  return (
    <AppShell title="Academic semesters" eyebrow="Academics">
      <section className="rounded-2xl border border-border bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
              Semester workspace
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Your curriculum is provisioned as one academic path.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              Choose an active semester explicitly. Programme semesters and their course defaults are retained;
              use a custom semester only for transfers, resits, deferment, or programme changes.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <CalendarDays className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">{curriculumSemesters.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Semesters
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <BookOpen className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">
                {curriculumSemesters.reduce((total, semester) => total + semester.enrollments.length, 0)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Enrollments
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <ListChecks className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">
                {curriculumSemesters.reduce((total, semester) => total + semester.openTaskCount, 0)}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Open tasks
              </p>
            </div>
          </div>
        </div>
      </section>

      {!hasProvisionedCurriculum ? <section className="mt-6 rounded-2xl border border-accent/30 bg-surface p-5"><h2 className="text-lg font-semibold">Set up your curriculum</h2><p className="mt-2 text-sm text-muted">Your account predates automatic curriculum setup. Provision the published programme path without changing your active semester or existing records.</p><form action={provisionExistingUserCurriculum} className="mt-4"><PendingSubmitButton pendingLabel="Provisioning curriculum..." className="h-10 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Provision my curriculum</PendingSubmitButton></form></section> : null}

      <section className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          {curriculumSemesters.length ? (
            curriculumSemesters.map((semester) => (
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
                  {semester.isCustom ? <form action={deleteSemester}>
                    <input type="hidden" name="semesterId" value={semester.id} />
                    <ConfirmSubmitButton
                      message={`Delete ${formatLevel(semester.level)} - ${semester.name}? This removes the semester from your workspace.`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form> : null}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-border bg-white p-5 text-sm text-muted">
              No curriculum semesters yet. Provision your programme path above.
            </p>
          )}
        </div>
      </section>

      {customSemesters.length ? <section className="mt-6"><details className="rounded-2xl border border-border bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Custom and legacy semesters ({customSemesters.length})</summary><p className="mt-2 text-sm text-muted">These records are kept separately so existing work is never deleted. Use them only for transfers, resits, deferment, or other exceptions.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{customSemesters.map((semester) => <Link key={semester.id} href={`/academics/semesters/${semester.id}`} className="rounded-xl border border-border p-4 hover:border-foreground"><p className="text-xs font-semibold uppercase text-muted">{semester.academicYear}</p><p className="mt-2 font-semibold">{formatLevel(semester.level)} - {semester.name}</p><p className="mt-1 text-sm text-muted">{semester.enrollments.length} courses</p></Link>)}</div></details></section> : null}
    </AppShell>
  );
}



