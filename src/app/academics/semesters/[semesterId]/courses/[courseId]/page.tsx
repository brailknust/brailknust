import Link from "next/link";
import { ArrowLeft, BarChart3, BookOpen, CalendarDays, ListChecks } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteWeakArea, saveWeakArea, updateEnrollmentPerformance } from "@/features/academics/actions";
import { deleteAssessment, saveAssessment } from "@/features/assessments/actions";
import { getCourseAnalytics } from "@/features/academics/queries";
import { requireAppUser } from "@/features/auth/queries";
import { deleteCourseMaterial, saveCourseMaterial } from "@/features/materials/actions";
import { MaterialUpload } from "@/features/materials/material-upload";
import { createTask } from "@/features/tasks/actions";

type CourseAnalyticsPageProps = {
  params: Promise<{
    semesterId: string;
    courseId: string;
  }>;
};

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatPercent(value: unknown) {
  return value === null || value === undefined ? "Not set" : `${value.toString()}%`;
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function studySessionTitle(value: string) {
  return value.split("||")[0]?.trim() || "Study session";
}

function studySessionSchedule(value: Date | null, durationMinutes: number | null) {
  if (!value) return "Time not scheduled";
  const day = weekDays[(value.getUTCDay() + 6) % 7];
  const end = new Date(value);
  end.setUTCMinutes(end.getUTCMinutes() + (durationMinutes ?? 60));
  return `${day}, ${formatTime(value)}-${formatTime(end)}`;
}

function percentageBar(value: unknown) {
  const numeric = Number(value?.toString() ?? 0);
  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0), 100) : 0;
}

export default async function CourseAnalyticsPage({ params }: CourseAnalyticsPageProps) {
  const { semesterId, courseId } = await params;
  const { appUser } = await requireAppUser();
  const analytics = await getCourseAnalytics(appUser.id, semesterId, courseId);

  if (!analytics) {
    notFound();
  }

  const { enrollment } = analytics;
  const assessmentAverage = analytics.assessments.length
    ? Math.round((analytics.assessments.reduce((sum, item) => sum + (Number(item.score) / Number(item.maxScore)) * 100, 0) / analytics.assessments.length) * 10) / 10
    : null;

  return (
    <AppShell title={`${enrollment.course.name} analytics`} eyebrow="Course">
      <Link
        href={`/academics/semesters/${semesterId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to semester
      </Link>

      <section className="rounded-2xl border border-border bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
              {enrollment.semester.name} {enrollment.semester.academicYear}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{enrollment.course.name}</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Track course-specific performance, workload, study sessions, and weak areas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <BarChart3 className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">{enrollment.currentGrade ?? "N/A"}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Grade
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <CalendarDays className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">{formatPercent(enrollment.attendance)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Attendance
              </p>
            </div>
            <div className="rounded-xl border border-background/15 bg-white/10 p-4">
              <ListChecks className="h-5 w-5 text-white/75" />
              <p className="mt-5 text-2xl font-semibold">{analytics.openTaskCount}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Open tasks
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="grid gap-6">
          <form action={updateEnrollmentPerformance} className="rounded-2xl border border-border bg-white p-5">
            <h2 className="text-lg font-semibold">Course performance</h2>
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <input type="hidden" name="semesterId" value={semesterId} />
            <input type="hidden" name="courseId" value={courseId} />
            <div className="mt-4 grid gap-4">
              <input
                name="lecturer"
                defaultValue={enrollment.lecturer ?? ""}
                placeholder="Lecturer"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
              />
              <input
                name="currentGrade"
                defaultValue={enrollment.currentGrade ?? ""}
                placeholder="Current grade"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Attendance %
                  <input
                    name="attendance"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={enrollment.attendance?.toString() ?? ""}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Confidence %
                  <input
                    name="confidenceScore"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={enrollment.confidenceScore?.toString() ?? ""}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                  />
                </label>
              </div>
              <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                Save performance
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Performance indicators</h2>
            <div className="mt-5 grid gap-5">
              {[
                ["Attendance", enrollment.attendance],
                ["Confidence", enrollment.confidenceScore],
              ].map(([label, value]) => (
                <div key={label?.toString()}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{label?.toString()}</span>
                    <span className="text-muted">{formatPercent(value)}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${percentageBar(value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Tasks done
              </p>
              <p className="mt-3 text-3xl font-semibold">
                {analytics.completedTaskCount}/{analytics.tasks.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Study sessions
              </p>
              <p className="mt-3 text-3xl font-semibold">
                {analytics.completedStudyItemCount}/{analytics.studyItems.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                Weak areas
              </p>
              <p className="mt-3 text-3xl font-semibold">{analytics.weakAreas.length}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-semibold">Assessments</h2><p className="mt-1 text-sm text-muted">Saved scores produce the course average and Performance history.</p></div>
              <p className="text-2xl font-semibold">{assessmentAverage === null ? "Not set" : `${assessmentAverage}%`}</p>
            </div>
            <form action={saveAssessment} className="mt-5 grid gap-3 rounded-xl border border-border bg-surface p-4">
              <input type="hidden" name="semesterId" value={semesterId} /><input type="hidden" name="courseId" value={courseId} />
              <div className="grid gap-3 sm:grid-cols-2"><input name="title" required placeholder="Assessment title" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" /><select name="type" defaultValue="QUIZ" className="h-11 rounded-xl border border-border bg-white px-3 text-sm">{["QUIZ","ASSIGNMENT","LAB","PROJECT","MIDSEM","EXAM","OTHER"].map((type) => <option key={type}>{type}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-4"><input name="score" required type="number" min="0" step="0.01" placeholder="Score" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" /><input name="maxScore" required type="number" min="0.01" step="0.01" placeholder="Out of" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" /><input name="weight" type="number" min="0.01" max="100" step="0.01" placeholder="Weight % optional" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" /><input name="assessedAt" type="date" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" /></div>
              <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Add assessment</button>
            </form>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {analytics.assessments.length ? analytics.assessments.map((item) => {
                const scorePercent = Math.round((Number(item.score) / Number(item.maxScore)) * 1000) / 10;
                return <article key={item.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted">{item.type} - {item.score.toString()}/{item.maxScore.toString()} ({scorePercent}%)</p></div><form action={deleteAssessment}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="semesterId" value={semesterId} /><input type="hidden" name="courseId" value={courseId} /><ConfirmSubmitButton message={`Delete assessment "${item.title}"?`} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted">Delete</ConfirmSubmitButton></form></div>
                  <details className="mt-3 border-t border-border pt-3"><summary className="cursor-pointer text-sm font-semibold text-accent">Edit</summary><form action={saveAssessment} className="mt-3 grid gap-3"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="semesterId" value={semesterId} /><input type="hidden" name="courseId" value={courseId} /><input name="title" required defaultValue={item.title} className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><select name="type" defaultValue={item.type} className="h-10 rounded-xl border border-border bg-white px-3 text-sm">{["QUIZ","ASSIGNMENT","LAB","PROJECT","MIDSEM","EXAM","OTHER"].map((type) => <option key={type}>{type}</option>)}</select><input name="assessedAt" type="date" defaultValue={item.assessedAt?.toISOString().slice(0,10) ?? ""} className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /></div><div className="grid gap-3 sm:grid-cols-3"><input name="score" required type="number" step="0.01" defaultValue={item.score.toString()} className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /><input name="maxScore" required type="number" step="0.01" defaultValue={item.maxScore.toString()} className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /><input name="weight" type="number" step="0.01" defaultValue={item.weight?.toString() ?? ""} placeholder="Weight %" className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /></div><button className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold">Save changes</button></form></details>
                </article>;
              }) : <p className="text-sm text-muted">No assessments recorded yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Course knowledge</h2>
                <p className="mt-1 text-sm text-muted">
                  Add trusted notes, slide text, and past questions for course-grounded AI answers.
                </p>
              </div>
            </div>

            <MaterialUpload
              enrollmentId={enrollment.id}
              semesterId={semesterId}
              courseId={courseId}
              topics={analytics.topics.map((topic) => ({ id: topic.id, title: topic.title }))}
            />

            <details className="mt-4 rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Or paste text manually
              </summary>
            <form action={saveCourseMaterial} className="mt-5 grid gap-3 rounded-xl border border-border bg-surface p-4">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <input type="hidden" name="semesterId" value={semesterId} />
              <input type="hidden" name="courseId" value={courseId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="Material title"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                />
                <select
                  name="type"
                  defaultValue="NOTE"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="NOTE">Lecture note</option>
                  <option value="SLIDE">Slide text</option>
                  <option value="PAST_QUESTION">Past question</option>
                  <option value="LINK">Web resource</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="topic"
                  maxLength={120}
                  list="course-topic-options"
                  placeholder="Topic, e.g. Binary trees"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                />
                <datalist id="course-topic-options">
                  {analytics.topics.map((topic) => <option key={topic.id} value={topic.title} />)}
                </datalist>
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder="Source link (optional)"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                />
              </div>
              <textarea
                name="content"
                required
                minLength={40}
                maxLength={100000}
                placeholder="Paste the relevant text from the notes, slides, course outline, or past questions..."
                className="min-h-44 rounded-xl border border-border bg-white px-3 py-3 text-sm leading-6"
              />
              <p className="text-xs leading-5 text-muted">
                Only material saved under this enrollment is retrieved in this course&apos;s conversations.
                Confirm that you have permission to add copyrighted material.
              </p>
              <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                Add to course knowledge
              </button>
            </form>
            </details>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {analytics.materials.length ? analytics.materials.map((material) => (
                <article key={material.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{material.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        {material.type.replace("_", " ")} · {material.status.toLowerCase()} · {material._count.chunks} searchable chunks
                      </p>
                      {material.chunks[0]?.topic ? (
                        <p className="mt-2 text-sm text-muted">Topic: {material.chunks[0].topic.title}</p>
                      ) : null}
                    </div>
                    <form action={deleteCourseMaterial}>
                      <input type="hidden" name="materialId" value={material.id} />
                      <input type="hidden" name="semesterId" value={semesterId} />
                      <input type="hidden" name="courseId" value={courseId} />
                      <ConfirmSubmitButton
                        message={`Delete "${material.title}" from the course knowledge base?`}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                  {material.sourceUrl ? (
                    <a
                      href={material.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-semibold text-accent"
                    >
                      Open source
                    </a>
                  ) : null}
                  {material.storagePath ? (
                    <a
                      href={`/api/materials/${material.id}/download`}
                      className="mt-3 ml-4 inline-flex text-sm font-semibold text-accent"
                    >
                      Download original
                    </a>
                  ) : null}
                  {material.errorMessage ? (
                    <p className="mt-3 text-sm text-red-600">{material.errorMessage}</p>
                  ) : null}
                </article>
              )) : (
                <p className="text-sm text-muted">No course material has been added yet.</p>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold">Course tasks</h2>
              {analytics.isActiveSemester ? (
                <form action={createTask} className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4">
                  <input type="hidden" name="courseId" value={courseId} />
                  <input
                    name="title"
                    required
                    placeholder="Task title"
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                  />
                  <textarea
                    name="description"
                    placeholder="Description"
                    className="min-h-20 rounded-xl border border-border bg-white px-3 py-3 text-sm"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold">
                      Due date
                      <input
                        name="dueAt"
                        type="datetime-local"
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Priority
                      <select
                        name="priority"
                        defaultValue="MEDIUM"
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </label>
                  </div>
                  <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                    Add course task
                  </button>
                </form>
              ) : (
                <p className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
                  Make this semester active before adding course tasks.
                </p>
              )}
              <div className="mt-4 grid gap-3">
                {analytics.tasks.length ? (
                  analytics.tasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {task.status.toLowerCase()} - {formatDateTime(task.dueAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No tasks are linked to this course yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold">Active study plan sessions</h2>
              <p className="mt-1 text-sm text-muted">
                The weekly times assigned to this course in your active study plan.
              </p>
              <div className="mt-4 grid gap-3">
                {analytics.studyItems.length ? (
                  analytics.studyItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="font-semibold">{studySessionTitle(item.title)}</p>
                      <p className="mt-1 text-sm text-muted">
                        {studySessionSchedule(item.scheduledStart, item.durationMinutes)}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                        {item.status.toLowerCase().replace("_", " ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">The active study plan has no sessions for this course yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold">Timetable</h2>
              <div className="mt-4 grid gap-3">
                {analytics.timetable.length ? (
                  analytics.timetable.map((block) => (
                    <div key={block.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="font-semibold">
                        {weekDays[block.dayOfWeek]} {formatTime(block.startTime)}-{formatTime(block.endTime)}
                      </p>
                      <p className="mt-1 text-sm text-muted">{block.venue ?? "Venue not set"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No timetable blocks are linked to this course.</p>
                )}
              </div>
            </div>

                        <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold">Weak areas</h2>
              <p className="mt-1 text-sm text-muted">Record topics needing more attention.</p>
              <form action={saveWeakArea} className="mt-4 grid gap-3 rounded-xl border border-border bg-surface p-4">
                <input type="hidden" name="semesterId" value={semesterId} />
                <input type="hidden" name="courseId" value={courseId} />
                <input name="topic" required placeholder="Topic" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="weaknessScore" type="number" min="0" max="100" step="0.01" placeholder="Weakness %" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
                  <input name="detectedFrom" placeholder="Detected from" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
                </div>
                <textarea name="recommendation" placeholder="Recommended next action" className="min-h-20 rounded-xl border border-border bg-white px-3 py-3 text-sm" />
                <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Add weak area</button>
              </form>
              <div className="mt-4 grid gap-3">
                {analytics.weakAreas.length ? analytics.weakAreas.map((area) => (
                  <article key={area.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{area.topic}</p><p className="mt-1 text-sm text-muted">Weakness: {formatPercent(area.weaknessScore)}</p>{area.detectedFrom ? <p className="mt-1 text-sm text-muted">From: {area.detectedFrom}</p> : null}</div>
                      <form action={deleteWeakArea}>
                        <input type="hidden" name="id" value={area.id} /><input type="hidden" name="semesterId" value={semesterId} /><input type="hidden" name="courseId" value={courseId} />
                        <ConfirmSubmitButton message={`Delete weak area "${area.topic}"?`} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted">Delete</ConfirmSubmitButton>
                      </form>
                    </div>
                    {area.recommendation ? <p className="mt-3 text-sm text-muted">{area.recommendation}</p> : null}
                    <details className="mt-4 border-t border-border pt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-accent">Edit</summary>
                      <form action={saveWeakArea} className="mt-3 grid gap-3">
                        <input type="hidden" name="id" value={area.id} /><input type="hidden" name="semesterId" value={semesterId} /><input type="hidden" name="courseId" value={courseId} />
                        <input name="topic" required defaultValue={area.topic} className="h-10 rounded-xl border border-border bg-white px-3 text-sm" />
                        <div className="grid gap-3 sm:grid-cols-2"><input name="weaknessScore" type="number" min="0" max="100" step="0.01" defaultValue={area.weaknessScore?.toString() ?? ""} placeholder="Weakness %" className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /><input name="detectedFrom" defaultValue={area.detectedFrom ?? ""} placeholder="Detected from" className="h-10 rounded-xl border border-border bg-white px-3 text-sm" /></div>
                        <textarea name="recommendation" defaultValue={area.recommendation ?? ""} placeholder="Recommendation" className="min-h-20 rounded-xl border border-border bg-white px-3 py-2 text-sm" />
                        <button className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold">Save changes</button>
                      </form>
                    </details>
                  </article>
                )) : <p className="text-sm text-muted">No weak areas have been recorded yet.</p>}
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
