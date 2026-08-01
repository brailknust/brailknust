import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Clock3, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createCourse,
  createEnrollment,
  createTimetableBlock,
  deleteEnrollment,
  deleteSemester,
  setActiveSemester,
  updateSemesterProfile,
} from "@/features/academics/actions";
import { getSemesterDetail } from "@/features/academics/queries";
import { requireAppUser } from "@/features/auth/queries";

type SemesterPageProps = {
  params: Promise<{
    semesterId: string;
  }>;
};

const levels = [
  ["LEVEL_100", "Level 100"],
  ["LEVEL_200", "Level 200"],
  ["LEVEL_300", "Level 300"],
  ["LEVEL_400", "Level 400"],
  ["LEVEL_500", "Level 500"],
  ["LEVEL_600", "Level 600"],
];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatCwa(value: unknown) {
  return value ? `${value.toString()}%` : "Not set";
}

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Level not set";
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

export default async function SemesterPage({ params }: SemesterPageProps) {
  const { semesterId } = await params;
  const { appUser } = await requireAppUser();
  const data = await getSemesterDetail(appUser.id, semesterId);

  if (!data.semester) {
    notFound();
  }

  const semester = data.semester;

  return (
    <AppShell
      title={`${formatLevel(data.profile?.level)} - ${semester.name}`}
      eyebrow="Semester"
    >
      <section className="rounded-lg border border-border bg-foreground p-5 text-background">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-background/70">
              Semester detail
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{semester.academicYear}</h2>
            <p className="mt-2 text-sm leading-6 text-background/70">
              Update this semester&apos;s CWA, manage courses, and open course cards for analytics.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-md border border-background/15 bg-background/10 p-4">
              <CalendarDays className="h-5 w-5 text-background/75" />
              <p className="mt-5 text-2xl font-semibold">{formatCwa(data.profile?.cwa)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-background/60">
                CWA
              </p>
            </div>
            <div className="rounded-md border border-background/15 bg-background/10 p-4">
              <BookOpen className="h-5 w-5 text-background/75" />
              <p className="mt-5 text-2xl font-semibold">{data.enrollments.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-background/60">
                Courses
              </p>
            </div>
            <div className="rounded-md border border-background/15 bg-background/10 p-4">
              <Clock3 className="h-5 w-5 text-background/75" />
              <p className="mt-5 text-2xl font-semibold">{data.timetable.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-background/60">
                Timetable
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="grid gap-6">
          <form action={updateSemesterProfile} className="rounded-lg border border-border bg-background p-5">
            <h2 className="text-lg font-semibold">Semester details</h2>
            <input type="hidden" name="semesterId" value={semester.id} />
            <div className="mt-4 grid gap-3">
              <select
                name="level"
                defaultValue={data.profile?.level ?? appUser.level ?? ""}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Select level</option>
                <option value="LEVEL_100">Level 100</option>
                <option value="LEVEL_200">Level 200</option>
                <option value="LEVEL_300">Level 300</option>
                <option value="LEVEL_400">Level 400</option>
                <option value="LEVEL_500">Level 500</option>
                <option value="LEVEL_600">Level 600</option>
              </select>
              <input
                name="cwa"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={data.profile?.cwa?.toString() ?? ""}
                placeholder="e.g. 72.45"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                Save CWA
              </button>
            </div>
          </form>

          {!data.isActiveForUser ? (
            <form action={setActiveSemester} className="rounded-lg border border-border bg-surface p-5">
              <input type="hidden" name="semesterId" value={semester.id} />
              <h2 className="text-lg font-semibold">Set as active</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Planner and dashboard summaries will use this semester first.
              </p>
              <button className="mt-4 h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                Make active semester
              </button>
            </form>
          ) : null}

          <form action={deleteSemester} className="rounded-lg border border-border bg-background p-5">
            <input type="hidden" name="semesterId" value={semester.id} />
            <h2 className="text-lg font-semibold">Delete semester</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Removes this semester from your academic workspace, including your enrollments
              for this semester.
            </p>
            <ConfirmSubmitButton
              message={`Delete ${formatLevel(data.profile?.level)} - ${semester.name}? This removes the semester from your workspace.`}
              className="mt-4 h-11 rounded-md border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
            >
              Delete semester
            </ConfirmSubmitButton>
          </form>

          <form action={createEnrollment} className="rounded-lg border border-border bg-background p-5">
            <h2 className="text-lg font-semibold">Enroll in course</h2>
            <input type="hidden" name="semesterId" value={semester.id} />
            <div className="mt-4 grid gap-3">
              <select name="courseId" required className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Select course</option>
                {data.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              <input
                name="lecturer"
                placeholder="Lecturer"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                Save enrollment
              </button>
            </div>
          </form>

          <form action={createCourse} className="rounded-lg border border-border bg-background p-5">
            <h2 className="text-lg font-semibold">Add course catalog item</h2>
            <div className="mt-4 grid gap-3">
              <input name="code" required placeholder="COE 153" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
              <input name="name" required placeholder="Engineering Technology" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="creditHours" type="number" min="0" max="12" placeholder="Credits" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
                <select name="level" defaultValue="" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">Course level</option>
                  {levels.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <input name="department" placeholder="Department" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
              <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                Save course
              </button>
            </div>
          </form>
        </div>

        <div className="grid gap-6">
          <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="text-lg font-semibold">Courses</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.enrollments.length ? (
                data.enrollments.map((enrollment) => (
                  <article
                    key={enrollment.id}
                    className="rounded-lg border border-border bg-surface p-5 transition hover:border-foreground"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{enrollment.course.name}</p>
                        <p className="mt-2 text-sm text-muted">{enrollment.course.code}</p>
                      </div>
                      <form action={deleteEnrollment}>
                        <input type="hidden" name="enrollmentId" value={enrollment.id} />
                        <input type="hidden" name="semesterId" value={semester.id} />
                        <ConfirmSubmitButton
                          message={`Remove ${enrollment.course.name} from ${formatLevel(data.profile?.level)} - ${semester.name}?`}
                          title="Remove course"
                          aria-label={`Remove ${enrollment.course.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Grade</p>
                        <p className="mt-1 text-sm">{enrollment.currentGrade ?? "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Attendance</p>
                        <p className="mt-1 text-sm">{formatCwa(enrollment.attendance)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Confidence</p>
                        <p className="mt-1 text-sm">{formatCwa(enrollment.confidenceScore)}</p>
                      </div>
                    </div>
                    <Link
                      href={`/academics/semesters/${semester.id}/courses/${enrollment.courseId}`}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      View analytics <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
                  No courses enrolled for this semester yet.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <form action={createTimetableBlock} className="rounded-lg border border-border bg-background p-5">
              <input type="hidden" name="semesterId" value={semester.id} />
              <h2 className="text-lg font-semibold">Add timetable block</h2>
              <div className="mt-4 grid gap-3">
                <select name="courseId" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">General busy block</option>
                  {data.enrollments.map((enrollment) => (
                    <option key={enrollment.courseId} value={enrollment.courseId}>
                      {enrollment.course.name}
                    </option>
                  ))}
                </select>
                <select name="dayOfWeek" defaultValue="0" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                  {weekDays.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="startTime" required type="time" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
                  <input name="endTime" required type="time" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
                </div>
                <input name="venue" placeholder="Venue" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
                <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
                  Save block
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">Timetable blocks</h2>
              <div className="mt-4 grid gap-3">
                {data.timetable.length ? (
                  data.timetable.map((block) => (
                    <div key={block.id} className="rounded-md border border-border bg-background p-4">
                      <p className="font-semibold">
                        {weekDays[block.dayOfWeek]} {formatTime(block.startTime)}-{formatTime(block.endTime)}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {block.course?.code ?? "Busy"} {block.venue ? `at ${block.venue}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No timetable blocks for these courses yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}


