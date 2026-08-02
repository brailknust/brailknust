import Link from "next/link";
import { Bell, BookOpen, GraduationCap, ListChecks } from "lucide-react";
import { redirect, unstable_rethrow } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getAcademicSetup } from "@/features/academics/queries";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { getDashboardNotifications } from "@/features/notifications/queries";
import { getTasksPageData } from "@/features/tasks/queries";

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
      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background">Retry dashboard</a>
          <a href="/login" className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold">Return to login</a>
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

  let academicSetup: Awaited<ReturnType<typeof getAcademicSetup>>;
  let taskData: Awaited<ReturnType<typeof getTasksPageData>>;
  let notificationData: Awaited<ReturnType<typeof getDashboardNotifications>>;
  try {
    [academicSetup, taskData, notificationData] = await Promise.all([
      getAcademicSetup(appUser.id),
      getTasksPageData(appUser.id),
      getDashboardNotifications(appUser.id),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Dashboard data load failed", error);
    return <DashboardUnavailable title="Database connection unavailable" message="BRAIL could not load your academic data from Supabase for this request." />;
  }

  const openTasks = taskData.tasks.filter((task) => task.status === "TODO");
  const upcomingTasks = openTasks.filter((task) => task.dueAt).slice(0, 3);

  return (
    <AppShell title={`Welcome, ${appUser.fullName}`} eyebrow="Dashboard">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Programme", value: appUser.programme ?? "Programme pending", icon: GraduationCap },
          { label: "Active semester", value: academicSetup.activeSemester ? `${formatLevel(appUser.level)} - ${academicSetup.activeSemester.name}` : "Not set", icon: BookOpen },
          { label: "Open tasks", value: `${openTasks.length} active`, icon: ListChecks },
        ].map((item) => (
          <article key={item.label} className="rounded-lg border border-border bg-surface p-5">
            <item.icon className="h-5 w-5 text-accent" />
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-semibold">{item.value}</p>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold">Upcoming deadlines</h2><p className="mt-1 text-sm text-muted">Only saved tasks with due dates appear here.</p></div>
          <Link href="/tasks" className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground">Tasks</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {upcomingTasks.length ? upcomingTasks.map((task) => (
            <div key={task.id} className="rounded-md border border-border bg-surface p-4">
              <p className="font-semibold">{task.title}</p>
              <p className="mt-1 text-sm text-muted">{task.course ? `${task.course.name} - ` : ""}{formatDateTime(task.dueAt)}</p>
            </div>
          )) : <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">No upcoming deadlines are saved yet.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-accent" /><div><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-sm text-muted">{notificationData.unreadCount} unread reminders</p></div></div>
          <Link href="/notifications" className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground">View all</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {notificationData.items.length ? notificationData.items.map((notification) => (
            <Link key={notification.id} href={`/notifications/${notification.id}/open`} className={"rounded-md border p-4 transition hover:border-foreground " + (notification.isRead ? "border-border bg-surface" : "border-accent/50 bg-background")}>
              <p className="font-semibold">{notification.title}</p><p className="mt-1 text-sm text-muted">{notification.message}</p><p className="mt-3 text-xs text-muted">{formatDateTime(notification.createdAt)}</p>
            </Link>
          )) : <p className="text-sm text-muted">No notifications yet.</p>}
        </div>
      </section>

    </AppShell>
  );
}
