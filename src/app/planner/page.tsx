import { CalendarDays, Clock3, ListChecks, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireAppUser } from "@/features/auth/queries";
import {
  createStudyPlan,
  createStudyPlanItem,
  updateStudyPlanItemStatus,
} from "@/features/planner/actions";
import { getPlannerData } from "@/features/planner/queries";
import { SavedStudyTimetable } from "@/app/planner/saved-study-timetable";
import { TimetableGenerator, type TimetableRow } from "@/app/planner/timetable-generator";
import { UnavailableTimesGrid } from "@/app/planner/unavailable-times-grid";

type PlannerPageProps = {
  searchParams?: Promise<{
    courseId?: string;
    planId?: string;
    day?: string;
  }>;
};

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatDate(value: Date | null) {
  if (!value) {
    return "No date set";
  }

  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
  }).format(value);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "No scheduled time";
  }

  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function formatSessionTime(value: Date | null) {
  if (!value) {
    return "Unscheduled";
  }

  return value.toISOString().slice(11, 16);
}

function sessionEndTime(value: Date | null, durationMinutes: number | null) {
  if (!value || !durationMinutes) {
    return "";
  }

  const endTime = new Date(value);
  endTime.setUTCMinutes(endTime.getUTCMinutes() + durationMinutes);
  return formatSessionTime(endTime);
}

function dayIndexFromDate(value: Date | null) {
  if (!value) {
    return -1;
  }

  return (value.getUTCDay() + 6) % 7;
}

function splitSessionTitle(value: string) {
  const [title, reason] = value.split("||").map((part) => part.trim());

  return {
    title: title || "Study session",
    reason: reason || "",
  };
}

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Level not set";
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const { appUser } = await requireAppUser();
  const params = searchParams ? await searchParams : {};
  const selectedCourseId = params.courseId ?? "";
  const planner = await getPlannerData(appUser.id, appUser.activeSemesterId);
  const requestedDayIndex = Number(params.day);
  const selectedDayIndex = Number.isInteger(requestedDayIndex) && requestedDayIndex >= 0 && requestedDayIndex <= 6
    ? requestedDayIndex
    : undefined;
  const selectedStudyPlan =
    planner.studyPlans.find((plan) => plan.id === params.planId) ??
    planner.activeStudyPlan;
  const isArchived = Boolean(planner.activeSemester?.isArchived);

  const courseOptions = planner.activeEnrollments.map((enrollment) => enrollment.course);
  const filteredTasks = selectedCourseId
    ? planner.openTasks.filter((task) => task.courseId === selectedCourseId)
    : planner.openTasks;
  const filteredPlanItems = selectedCourseId
    ? selectedStudyPlan?.items.filter((item) => item.courseId === selectedCourseId) ?? []
    : selectedStudyPlan?.items ?? [];
  const scheduledPlanItems = filteredPlanItems.filter((item) => item.scheduledStart);
  const unscheduledPlanItems = filteredPlanItems.filter((item) => !item.scheduledStart);
  const activeSemesterTitle = planner.activeSemester
    ? `${formatLevel(planner.activeSemesterProfile?.level ?? appUser.level)} - ${planner.activeSemester.name}`
    : "No active semester set";
  const savedStudySessions = scheduledPlanItems.map((item) => {
    const session = splitSessionTitle(item.title);
    const endTime = sessionEndTime(item.scheduledStart, item.durationMinutes);

    return {
      id: item.id,
      courseId: item.courseId,
      dayIndex: dayIndexFromDate(item.scheduledStart),
      startTime: formatSessionTime(item.scheduledStart),
      endTime,
      title: session.title,
      courseLabel: item.course ? item.course.name : "General study",
      durationLabel: item.durationMinutes ? `${item.durationMinutes} minutes` : "Duration not set",
      reason: item.aiReason ?? session.reason,
    };
  });
  const unavailableBlocks = planner.timetable.map((block) => ({
    id: block.id,
    dayOfWeek: block.dayOfWeek,
    startTime: formatTime(block.startTime),
    endTime: formatTime(block.endTime),
    courseName: block.course?.name ?? null,
  }));
  const savedClassRows: TimetableRow[] = planner.timetable
    .filter((block) => block.course)
    .map((block) => ({
      id: block.id,
      courseCode: block.course!.code,
      courseName: block.course!.name,
      dayOfWeek: weekDays[block.dayOfWeek] ?? "Monday",
      startTime: formatTime(block.startTime),
      endTime: formatTime(block.endTime),
      venue: block.venue ?? "",
      confidence: 1,
    }));

  return (
    <AppShell title="Study planner" eyebrow="Planner">
      <section className="rounded-2xl border border-border bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
              Planning context
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {activeSemesterTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              {planner.activeSemester ? `${planner.activeSemester.academicYear} - ` : ""}
              BRAIL is using your active semester courses, saved deadlines, and timetable blocks
              as the base for study planning.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            {[
              {
                label: "Courses",
                value: planner.activeEnrollments.length,
                icon: CalendarDays,
              },
              {
                label: "Open tasks",
                value: planner.openTasks.length,
                icon: ListChecks,
              },
              {
                label: "Busy blocks",
                value: planner.timetable.length,
                icon: Clock3,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-background/15 bg-white/10 p-4">
                <item.icon className="h-5 w-5 text-white/75" />
                <p className="mt-5 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isArchived ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Archived semester</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Planner history is read-only because the active semester is archived.
          </p>
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-6">
          <form action="/planner" className="rounded-2xl border border-border bg-white p-5">
            {selectedStudyPlan ? <input type="hidden" name="planId" value={selectedStudyPlan.id} /> : null}
            <h2 className="text-lg font-semibold">Course filter</h2>
            <div className="mt-4 grid gap-3">
              <select
                name="courseId"
                defaultValue={selectedCourseId}
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
              >
                <option value="">All active semester courses</option>
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              <PendingSubmitButton className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                Apply filter
              </PendingSubmitButton>
            </div>
          </form>

          <form action={createStudyPlan} className="rounded-2xl border border-border bg-white p-5">
            <h2 className="text-lg font-semibold">Create study plan</h2>
            <fieldset disabled={isArchived} className="mt-4 grid gap-3 disabled:opacity-60">
              <input
                name="title"
                required
                placeholder="e.g. Week 3 revision plan"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
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
              <PendingSubmitButton className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white" pendingLabel="Saving plan...">
                Save plan
              </PendingSubmitButton>
            </fieldset>
          </form>

          {!isArchived ? <TimetableGenerator
            activeCourseCount={courseOptions.length}
            initialRows={savedClassRows}
          /> : null}
        </div>

        <div className="grid gap-6">
          <section className="rounded-2xl border border-border bg-white p-5">
            {planner.studyPlans.length > 1 ? (
              <form
                action="/planner"
                className="mb-5 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <label className="grid gap-2 text-sm font-semibold">
                  View study plan
                  <select
                    name="planId"
                    defaultValue={selectedStudyPlan?.id}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                  >
                    {planner.studyPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title} ({plan.generatedByAi ? "Generated" : "Manual"})
                      </option>
                    ))}
                  </select>
                </label>
                {selectedCourseId ? (
                  <input type="hidden" name="courseId" value={selectedCourseId} />
                ) : null}
                <PendingSubmitButton className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                  View plan
                </PendingSubmitButton>
              </form>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedStudyPlan?.title ?? "No study plan yet"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedStudyPlan
                    ? `${formatDate(selectedStudyPlan.startDate)} - ${formatDate(selectedStudyPlan.endDate)}`
                    : "Create a plan to start adding study sessions."}
                </p>
              </div>
              {selectedStudyPlan ? (
                <span className="rounded-xl border border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {selectedStudyPlan.generatedByAi ? "generated" : "manual"}
                </span>
              ) : null}
            </div>

            {savedStudySessions.length ? (
              <SavedStudyTimetable studyPlanId={selectedStudyPlan.id} sessions={savedStudySessions} courseOptions={courseOptions} initialDayIndex={selectedDayIndex} readOnly={isArchived} />
            ) : (
              <div className="mt-5">
                <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                  No generated timetable yet. Generate from enrolled courses or upload a timetable image first.
                </p>
              </div>
            )}

            <div className="hidden">
              {scheduledPlanItems.length ? (
                weekDays.map((day, dayIndex) => {
                  const dayItems = scheduledPlanItems.filter(
                    (item) => dayIndexFromDate(item.scheduledStart) === dayIndex,
                  );

                  return (
                    <article key={day} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold">{day}</h3>
                        <span className="rounded-xl border border-border px-2 py-1 text-xs font-semibold text-muted">
                          {dayItems.length} session{dayItems.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {dayItems.length ? (
                        <div className="mt-4 grid gap-3">
                          {dayItems.map((item) => {
                            const session = splitSessionTitle(item.title);
                            const endTime = sessionEndTime(item.scheduledStart, item.durationMinutes);

                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border-l-4 border-accent bg-white p-4"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-accent">
                                      {formatSessionTime(item.scheduledStart)}
                                      {endTime ? ` - ${endTime}` : ""}
                                    </p>
                                    <p className="mt-2 font-semibold">{session.title}</p>
                                    <p className="mt-1 text-sm text-muted">
                                      {item.course ? item.course.name : "General study"}
                                      {item.durationMinutes ? ` ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${item.durationMinutes} min` : ""}
                                    </p>
                                    {session.reason || item.aiReason ? (
                                      <p className="mt-2 text-sm leading-6 text-muted">
                                        {item.aiReason ?? session.reason}
                                      </p>
                                    ) : null}
                                  </div>
                                  <form action={updateStudyPlanItemStatus} className="flex gap-2">
                                    <input type="hidden" name="id" value={item.id} />
                                    <select
                                      name="status"
                                      defaultValue={item.status}
                                      className="h-10 rounded-xl border border-border bg-white px-2 text-sm"
                                    >
                                      <option value="TODO">Todo</option>
                                      <option value="IN_PROGRESS">In progress</option>
                                      <option value="DONE">Done</option>
                                      <option value="ARCHIVED">Archive</option>
                                    </select>
                                    <button className="h-10 rounded-xl border border-border px-3 text-sm font-semibold">
                                      Update
                                    </button>
                                  </form>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl border border-border bg-white p-3 text-sm text-muted">
                          No planned study sessions for {day}.
                        </p>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                  No generated timetable yet. Generate from enrolled courses or upload a timetable image first.
                </p>
              )}
            </div>

            {unscheduledPlanItems.length ? (
              <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                <h3 className="font-semibold">Unscheduled sessions</h3>
                <div className="mt-3 grid gap-2">
                  {unscheduledPlanItems.map((item) => (
                    <p key={item.id} className="text-sm text-muted">
                      {splitSessionTitle(item.title).title}
                      {item.course ? ` · ${item.course.name}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedStudyPlan && !isArchived ? (
              <details id="manual-study-session" className="mt-5 rounded-xl border border-border bg-surface p-4">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                  <Plus className="h-4 w-4" />
                  Add manual study session
                </summary>
                <form action={createStudyPlanItem} className="mt-4 grid gap-3">
                  <input type="hidden" name="studyPlanId" value={selectedStudyPlan.id} />
                  <input
                    name="title"
                    required
                    defaultValue="Revise notes"
                    aria-label="Description"
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                      Course
                      <select
                        name="courseId"
                        defaultValue={selectedCourseId}
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      >
                        <option value="">General study</option>
                        {courseOptions.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                      Day
                      <select
                        name="dayOfWeek"
                        required
                        defaultValue={selectedDayIndex ?? 0}
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      >
                        {weekDays.map((day, index) => (
                          <option key={day} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Start time
                      <input
                        name="startTime"
                        type="time"
                        required
                        defaultValue="18:00"
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      End time
                      <input
                        name="endTime"
                        type="time"
                        required
                        defaultValue="19:00"
                        className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <PendingSubmitButton pendingLabel="Adding session..." className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                    Add session
                  </PendingSubmitButton>
                </form>
              </details>
            ) : null}
          </section>

          <UnavailableTimesGrid blocks={unavailableBlocks} readOnly={isArchived} />

          <section>
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold">Open tasks</h2>
              <div className="mt-4 grid gap-3">
                {filteredTasks.length ? (
                  filteredTasks.slice(0, 8).map((task) => (
                    <article key={task.id} className="rounded-xl border border-border bg-surface p-4">
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {task.course ? `${task.course.name} - ` : ""}
                        {formatDateTime(task.dueAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                    No open tasks match this view.
                  </p>
                )}
              </div>
            </div>

          </section>
        </div>
      </section>
    </AppShell>
  );
}

