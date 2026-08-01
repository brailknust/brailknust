import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/features/auth/queries";
import { createTask, updateTaskStatus } from "@/features/tasks/actions";
import { getTasksPageData } from "@/features/tasks/queries";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function formatDueDate(value: Date | null) {
  if (!value) return "No due date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function TasksPage() {
  const { appUser } = await requireAppUser();
  const { tasks, courses } = await getTasksPageData(appUser.id);

  return (
    <AppShell title="Tasks and deadlines" eyebrow="Phase 2">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={createTask} className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-lg font-semibold">Add task</h2>
          <div className="mt-5 grid gap-4">
            <input name="title" required placeholder="Assignment title" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
            <textarea name="description" placeholder="Details or notes" className="min-h-28 rounded-md border border-border bg-background px-3 py-3 text-sm" />
            <select name="courseId" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">No course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input name="dueAt" type="datetime-local" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
              <select name="priority" defaultValue="MEDIUM" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
              Save task
            </button>
          </div>
        </form>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Current tasks</h2>
          <div className="mt-5 grid gap-3">
            {tasks.length ? (
              tasks.map((task) => (
                <article key={task.id} className="rounded-md border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {task.course?.code ?? "General"} - {formatDueDate(task.dueAt)}
                      </p>
                      {task.description ? (
                        <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-md border border-border px-2 py-1 text-muted">
                        {task.priority}
                      </span>
                      <span className="rounded-md border border-border px-2 py-1 text-muted">
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <form action={updateTaskStatus} className="mt-4 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={task.id} />
                    {["TODO", "IN_PROGRESS", "DONE"].map((status) => (
                      <button
                        key={status}
                        name="status"
                        value={status}
                        className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </form>
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
