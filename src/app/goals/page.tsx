import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  Gauge,
  Pencil,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireAppUser } from "@/features/auth/queries";
import { deleteGoal, saveGoal, updateGoalStatus } from "@/features/goals/actions";
import { getGoalsPageData } from "@/features/goals/queries";

const categoryOptions = [
  ["ACADEMIC", "Academic"],
  ["STUDY_TIME", "Study time"],
  ["COURSE_MASTERY", "Course mastery"],
  ["TASKS", "Tasks"],
  ["PERSONAL", "Personal"],
] as const;

const metricOptions = [
  ["MANUAL", "Manual progress"],
  ["CWA", "Current CWA (%)"],
  ["STUDY_MINUTES", "Completed study (minutes)"],
  ["TASKS_COMPLETED", "Completed tasks"],
  ["ASSESSMENT_AVERAGE", "Assessment average (%)"],
] as const;

const periodOptions = [
  ["SEMESTER", "Whole semester"],
  ["WEEKLY", "This week"],
] as const;

const fieldClassName = "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm";
type GoalView = Awaited<ReturnType<typeof getGoalsPageData>>["goals"][number];
type CourseOption = Awaited<ReturnType<typeof getGoalsPageData>>["courses"][number];

function labelFor(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value.replaceAll("_", " ");
}

function formatDeadline(value: Date | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

function formatValue(metric: GoalView["metric"], value: number) {
  if (metric === "CWA" || metric === "ASSESSMENT_AVERAGE") return `${value}%`;
  if (metric === "STUDY_MINUTES") return `${value} min`;
  return value.toString();
}

function GoalFields({ goal, courses }: { goal?: GoalView; courses: CourseOption[] }) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        Goal title
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={goal?.title}
          placeholder="Raise my assessment average"
          className={fieldClassName}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Category
          <select name="category" defaultValue={goal?.category ?? "ACADEMIC"} className={fieldClassName}>
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Progress source
          <select name="metric" defaultValue={goal?.metric ?? "MANUAL"} className={fieldClassName}>
            {metricOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Period
          <select name="period" defaultValue={goal?.period ?? "SEMESTER"} className={fieldClassName}>
            {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Course
          <select name="courseId" defaultValue={goal?.courseId ?? ""} className={fieldClassName}>
            <option value="">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          Target
          <input name="targetValue" type="number" min="0.1" max="1000000" step="0.1" required defaultValue={goal?.targetValue} className={fieldClassName} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Manual progress
          <input name="currentValue" type="number" min="0" max="1000000" step="0.1" defaultValue={goal?.storedCurrentValue ?? 0} className={fieldClassName} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Deadline
          <input name="deadline" type="date" defaultValue={goal?.deadline?.toISOString().slice(0, 10)} className={fieldClassName} />
        </label>
      </div>
    </div>
  );
}

function GoalCard({ goal, courses }: { goal: GoalView; courses: CourseOption[] }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <span>{labelFor(categoryOptions, goal.category)}</span>
            <span aria-hidden="true">/</span>
            <span>{labelFor(periodOptions, goal.period)}</span>
            {goal.course ? <span className="rounded-xl border border-border px-2 py-1">{goal.course.name}</span> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold">{goal.title}</h3>
          <p className="mt-1 text-sm text-muted">{labelFor(metricOptions, goal.metric)} / {formatDeadline(goal.deadline)}</p>
        </div>
        <span className={`w-fit rounded-xl px-2.5 py-1 text-xs font-semibold ${
          goal.status === "COMPLETED" || goal.targetReached
            ? "bg-accent/15 text-accent"
            : "border border-border text-muted"
        }`}>
          {goal.status === "COMPLETED" ? "Completed" : goal.targetReached ? "Target reached" : "Active"}
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold">
            {formatValue(goal.metric, goal.currentValue)}
            <span className="text-base font-normal text-muted"> / {formatValue(goal.metric, goal.targetValue)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{goal.progress}% progress</p>
        </div>
        <Gauge className="h-5 w-5 text-accent" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${goal.progress}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <form action={updateGoalStatus}>
          <input type="hidden" name="id" value={goal.id} />
          {goal.status === "ACTIVE" ? (
            <button name="status" value="COMPLETED" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white">
              <Check className="h-4 w-4" /> Complete
            </button>
          ) : (
            <button name="status" value="ACTIVE" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
              <RotateCcw className="h-4 w-4" /> Reopen
            </button>
          )}
        </form>
        {goal.status !== "ARCHIVED" ? (
          <form action={updateGoalStatus}>
            <input type="hidden" name="id" value={goal.id} />
            <button name="status" value="ARCHIVED" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted hover:text-foreground">
              <Archive className="h-4 w-4" /> Archive
            </button>
          </form>
        ) : null}
        <details className="w-full">
          <summary className="mt-2 inline-flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
            <Pencil className="h-4 w-4" /> Edit goal
          </summary>
          <form action={saveGoal} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="id" value={goal.id} />
            <GoalFields goal={goal} courses={courses} />
            <PendingSubmitButton className="mt-4 h-10 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white" pendingLabel="Saving...">Save changes</PendingSubmitButton>
          </form>
        </details>
        <form action={deleteGoal} className="ml-auto">
          <input type="hidden" name="id" value={goal.id} />
          <ConfirmSubmitButton
            message={`Delete "${goal.title}" permanently?`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-600"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </article>
  );
}

export default async function GoalsPage() {
  const { appUser } = await requireAppUser();
  const data = await getGoalsPageData(appUser.id);

  if (!data.activeSemester) {
    return (
      <AppShell title="Goals" eyebrow="Progress">
        <section className="rounded-2xl border border-border bg-white p-6">
          <Target className="h-6 w-6 text-accent" />
          <h2 className="mt-5 text-xl font-semibold">Set an active semester first</h2>
          <p className="mt-2 text-sm text-muted">Goals are kept separate for each semester.</p>
          <Link href="/academics" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
            Choose a semester <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </AppShell>
    );
  }

  const level = data.profile?.level ? `Level ${data.profile.level.replace("LEVEL_", "")}` : "Level not set";
  const visibleGoals = data.goals.filter((goal) => goal.status !== "ARCHIVED");
  const archivedGoals = data.goals.filter((goal) => goal.status === "ARCHIVED");
  const completed = visibleGoals.filter((goal) => goal.status === "COMPLETED").length;
  const reached = visibleGoals.filter((goal) => goal.targetReached).length;

  return (
    <AppShell title="Goals" eyebrow="Progress">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/65">Active semester</p>
            <h2 className="mt-2 text-2xl font-semibold">{level} - {data.activeSemester.name}</h2>
            <p className="mt-2 text-sm text-white/70">{data.activeSemester.academicYear}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Active", visibleGoals.length - completed],
              ["Completed", completed],
              ["Reached", reached],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 rounded-xl bg-white/10 p-3 text-center">
                <p className="text-xl font-semibold">{value}</p>
                <p className="text-xs text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="self-start rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Add goal</h2>
          </div>
          <form action={saveGoal} className="mt-5">
            <GoalFields courses={data.courses} />
            <PendingSubmitButton className="mt-5 h-11 w-full rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white" pendingLabel="Creating...">
              Create goal
            </PendingSubmitButton>
          </form>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Semester goals</h2>
              <p className="mt-1 text-sm text-muted">Progress updates from saved academic and planner records.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-accent" />
          </div>
          <div className="mt-5 grid gap-4">
            {visibleGoals.length ? visibleGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} courses={data.courses} />
            )) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <Target className="mx-auto h-6 w-6 text-accent" />
                <p className="mt-3 font-semibold">No goals for this semester</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {archivedGoals.length ? (
        <details className="mt-6 rounded-2xl border border-border bg-white p-5">
          <summary className="cursor-pointer font-semibold">Archived goals ({archivedGoals.length})</summary>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {archivedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} courses={data.courses} />)}
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}
