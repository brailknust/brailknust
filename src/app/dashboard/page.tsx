import Link from "next/link";
import { Bell, BookOpen, GraduationCap, ListChecks } from "lucide-react";
import { redirect, unstable_rethrow } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getActiveSemesterSummary } from "@/features/academics/queries";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { getDashboardNotifications } from "@/features/notifications/queries";
import { getDashboardTasks } from "@/features/tasks/queries";

function formatDateTime(value: Date | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function formatLevel(value: string | null | undefined) {
  return value ? `Level ${value.replace("LEVEL_", "")}` : "Level not set";
}

function DashboardUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <AppShell title="Dashboard" eyebrow="Dashboard">
      <section className="rounded-2xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Retry dashboard</a>
          <a href="/login" className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold">Return to login</a>
        </div>
      </section>
    </AppShell>
  );
}

export default async function DashboardPage() {
  let authUser: Awaited<ReturnType<typeof getSupabaseUser>>;
  try {
    authUser = await getSupabaseUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Dashboard auth load failed", error);
    return <DashboardUnavailable title="Auth connection unavailable" message="BRAIL could not reach Supabase Auth to verify your session. Your local app is running, but the auth request timed out before the dashboard could load." />;
  }

  if (!authUser) redirect("/login");

  let appUser: Awaited<ReturnType<typeof getAppUserByAuthId>>;
  try {
    appUser = await getAppUserByAuthId(authUser.id);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Dashboard user load failed", error);
    return <DashboardUnavailable title="Database connection unavailable" message="BRAIL confirmed your Supabase session, but could not reach the Postgres database to load your profile." />;
  }

  if (!appUser) redirect("/onboarding");

  let activeSemester: Awaited<ReturnType<typeof getActiveSemesterSummary>>;
  let tasks: Awaited<ReturnType<typeof getDashboardTasks>>;
  let notificationData: Awaited<ReturnType<typeof getDashboardNotifications>>;
  try {
    [activeSemester, tasks, notificationData] = await Promise.all([
      getActiveSemesterSummary(appUser.id, appUser.activeSemesterId),
      getDashboardTasks(appUser.id, appUser.activeSemesterId),
      getDashboardNotifications(appUser.id),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Dashboard data load failed", error);
    return <DashboardUnavailable title="Database connection unavailable" message="BRAIL could not load your academic data from Supabase for this request." />;
  }

  const openTasks = tasks.filter((task) => task.status === "TODO");
  const upcomingTasks = openTasks.filter((task) => task.dueAt).slice(0, 3);

  return (
    <AppShell title={`Welcome, ${appUser.fullName}`} eyebrow="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Programme", value: appUser.programme ?? "Programme pending", icon: GraduationCap },
          { label: "Active semester", value: activeSemester ? `${formatLevel(appUser.level)} - ${activeSemester.name}` : "Not set", icon: BookOpen },
          { label: "Open tasks", value: `${openTasks.length} active`, icon: ListChecks },
          { label: "Unread reminders", value: `${notificationData.unreadCount} new`, icon: Bell },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-border bg-white p-5 shadow-[0_10px_30px_rgba(4,92,46,0.035)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{item.label}</p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.02em]">{item.value}</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-accent">
                <item.icon className="h-5 w-5" />
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_10px_30px_rgba(4,92,46,0.03)]">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Upcoming deadlines</h2><p className="mt-1 text-sm text-muted">Only saved tasks with due dates appear here.</p></div>
          <Link href="/tasks" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground">Tasks</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {upcomingTasks.length ? upcomingTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1 text-sm text-muted">{task.course ? `${task.course.name} - ` : ""}{formatDateTime(task.dueAt)}</p>
            </div>
          )) : <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No upcoming deadlines are saved yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_10px_30px_rgba(4,92,46,0.03)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-accent" /><div><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-sm text-muted">{notificationData.unreadCount} unread reminders</p></div></div>
          <Link href="/notifications" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground">View all</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {notificationData.items.length ? notificationData.items.map((notification) => (
            <Link key={notification.id} href={`/notifications/${notification.id}/open`} className={"rounded-xl border p-4 transition hover:border-foreground " + (notification.isRead ? "border-border bg-surface" : "border-accent/50 bg-white")}>
              <p className="font-semibold">{notification.title}</p><p className="mt-1 text-sm text-muted">{notification.message}</p><p className="mt-3 text-xs text-muted">{formatDateTime(notification.createdAt)}</p>
            </Link>
          )) : <p className="text-sm text-muted">No notifications yet.</p>}
        </div>
      </section>
      </div>

    </AppShell>
  );
}
