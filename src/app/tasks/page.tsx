import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatAccraDateTimeInput } from "@/features/academics/time";
import { requireAppUser } from "@/features/auth/queries";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/features/tasks/actions";
import { getTasksPageData } from "@/features/tasks/queries";
import { allowedNextTaskStatuses } from "@/features/tasks/status";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatDueDate(value: Date | null) {
  if (!value) return "No due date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatReminder(value: Date | null) {
  return value ? `Reminder: ${formatDueDate(value)}` : null;
}

export default async function TasksPage() {
  const { appUser } = await requireAppUser();
  const { activeSemester, tasks, courses } = await getTasksPageData(appUser.id, appUser.activeSemesterId);
  const isArchived = Boolean(activeSemester?.isArchived);

  return (
    <AppShell title="Tasks and deadlines" eyebrow="Phase 2">
      {isArchived ? (
        <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Archived semester</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Tasks are read-only because the active semester is archived.
          </p>
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={createTask} className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Add task</h2>
          <fieldset disabled={isArchived || !activeSemester} className="mt-5 grid gap-4 disabled:opacity-60">
            <input name="title" aria-label="Task title" required placeholder="Assignment title" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
            <textarea name="description" aria-label="Task description" placeholder="Details or notes" className="min-h-28 rounded-xl border border-border bg-white px-3 py-3 text-sm" />
            <select name="courseId" aria-label="Task course" className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
              <option value="">No course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Due date and time
                <input name="dueAt" type="datetime-local" aria-label="Task due date" aria-describedby="task-due-date-help" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" />
                <span id="task-due-date-help" className="text-xs font-normal text-muted">Enter when this task or assignment must be submitted.</span>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Reminder date and time (optional)
                <input name="reminderAt" type="datetime-local" aria-label="Task reminder date" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" />
                <span className="text-xs font-normal text-muted">BRAIL will notify you at this time.</span>
              </label>
            </div>
            <select name="priority" defaultValue="MEDIUM" aria-label="Task priority" className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <PendingSubmitButton pendingLabel="Saving task..." className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
              Save task
            </PendingSubmitButton>
          </fieldset>
        </form>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Current tasks</h2>
          <div className="mt-5 grid gap-3">
            {tasks.length ? (
              tasks.map((task) => (
                <article key={task.id} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {task.course?.code ?? "General"} - {formatDueDate(task.dueAt)}
                      </p>
                      {formatReminder(task.reminderAt) ? <p className="mt-1 text-xs text-muted">{formatReminder(task.reminderAt)}</p> : null}
                      {task.description ? (
                        <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-xl border border-border px-2 py-1 text-muted">
                        {task.priority}
                      </span>
                      <span className="rounded-xl border border-border px-2 py-1 text-muted">
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {!isArchived ? <details className="mt-4 border-t border-border pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-accent">Edit task</summary>
                    <form action={updateTask} className="mt-3 grid gap-3">
                      <input type="hidden" name="id" value={task.id} />
                      <input name="title" aria-label="Edit task title" required minLength={2} maxLength={160} defaultValue={task.title} className="h-10 rounded-md border border-border bg-white px-3 text-sm" />
                      <textarea name="description" aria-label="Edit task description" maxLength={5000} defaultValue={task.description ?? ""} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" />
                      <select name="courseId" aria-label="Edit task course" defaultValue={task.courseId ?? ""} className="h-10 rounded-md border border-border bg-white px-3 text-sm"><option value="">No course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
                      <div className="grid gap-3 sm:grid-cols-2"><input name="dueAt" type="datetime-local" aria-label="Edit task due date" defaultValue={formatAccraDateTimeInput(task.dueAt)} className="h-10 rounded-md border border-border bg-white px-3 text-sm" /><input name="reminderAt" type="datetime-local" aria-label="Edit task reminder date" defaultValue={formatAccraDateTimeInput(task.reminderAt)} className="h-10 rounded-md border border-border bg-white px-3 text-sm" /></div>
                      <select name="priority" aria-label="Edit task priority" defaultValue={task.priority} className="h-10 rounded-md border border-border bg-white px-3 text-sm">{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select>
                      <PendingSubmitButton pendingLabel="Updating..." className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted">Save changes</PendingSubmitButton>
                    </form>
                  </details> : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    {!isArchived ? <form action={updateTaskStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={task.id} />
                      {allowedNextTaskStatuses(task.status).map((status) => (
                        <PendingSubmitButton
                          key={status}
                          name="status"
                          value={status}
                          pendingLabel="Updating..."
                          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                        >
                          {status.replace("_", " ")}
                        </PendingSubmitButton>
                      ))}
                    </form> : null}
                    {!isArchived ? <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <ConfirmSubmitButton
                        message={`Delete "${task.title}" permanently?`}
                        className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-600 hover:text-red-800"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form> : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted">No tasks yet.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
