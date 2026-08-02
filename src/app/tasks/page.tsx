import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAppUser } from "@/features/auth/queries";
import { createTask, deleteTask, updateTaskStatus } from "@/features/tasks/actions";
import { getTasksPageData } from "@/features/tasks/queries";

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
  const { tasks, courses } = await getTasksPageData(appUser.id);

  return (
    <AppShell title="Tasks and deadlines" eyebrow="Phase 2">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={createTask} className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Add task</h2>
          <div className="mt-5 grid gap-4">
            <input name="title" required placeholder="Assignment title" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
            <textarea name="description" placeholder="Details or notes" className="min-h-28 rounded-xl border border-border bg-white px-3 py-3 text-sm" />
            <select name="courseId" className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
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
                <input name="dueAt" type="datetime-local" aria-describedby="task-due-date-help" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" />
                <span id="task-due-date-help" className="text-xs font-normal text-muted">Enter when this task or assignment must be submitted.</span>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Reminder date and time (optional)
                <input name="reminderAt" type="datetime-local" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" />
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
            <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
              Save task
            </button>
          </div>
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
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <form action={updateTaskStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={task.id} />
                      {(task.status === "EXPIRED" ? ["DONE"] : ["TODO", "DONE"]).map((status) => (
                        <button
                          key={status}
                          name="status"
                          value={status}
                          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                        >
                          {status.replace("_", " ")}
                        </button>
                      ))}
                    </form>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <ConfirmSubmitButton
                        message={`Delete "${task.title}" permanently?`}
                        className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-600 hover:text-red-800"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
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
