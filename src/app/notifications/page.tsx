import Link from "next/link";
import { Bell, CheckCheck, Clock3, ExternalLink, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { BrowserAlertSettings } from "@/app/notifications/browser-alert-settings";
import { requireAppUser } from "@/features/auth/queries";
import {
  deleteNotification,
  markAllNotificationsRead,
  updateNotificationPreferences,
  updateNotificationReadState,
} from "@/features/notifications/actions";
import { getNotificationCenterData } from "@/features/notifications/queries";

type NotificationsPageProps = {
  searchParams: Promise<{ view?: string }>;
};

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { appUser } = await requireAppUser();
  const params = await searchParams;
  const unreadOnly = params.view === "unread";
  const data = await getNotificationCenterData(appUser.id, unreadOnly);
  const preferences = data.preferences;

  return (
    <AppShell title="Notifications" eyebrow="Reminders">
      <section className="rounded-lg bg-foreground p-5 text-background">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-background/65">Notification center</p>
            <h2 className="mt-2 text-2xl font-semibold">{data.unreadCount} unread</h2>
            <p className="mt-2 text-sm text-background/70">Deadlines, study sessions, groups, goals, and peer answers</p>
          </div>
          {data.unreadCount ? (
            <form action={markAllNotificationsRead}>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-background px-4 text-sm font-semibold text-foreground">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section>
          <nav className="flex gap-2 border-b border-border">
            <Link href="/notifications" className={`border-b-2 px-4 py-3 text-sm font-semibold ${!unreadOnly ? "border-accent text-accent" : "border-transparent text-muted"}`}>All</Link>
            <Link href="/notifications?view=unread" className={`border-b-2 px-4 py-3 text-sm font-semibold ${unreadOnly ? "border-accent text-accent" : "border-transparent text-muted"}`}>Unread</Link>
          </nav>

          <div className="mt-5 grid gap-3">
            {data.notifications.length ? data.notifications.map((notification) => (
              <article key={notification.id} className={`rounded-lg border p-4 ${notification.isRead ? "border-border bg-background" : "border-accent/50 bg-surface"}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${notification.isRead ? "bg-surface text-muted" : "bg-accent text-white"}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{notification.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted">{notification.message}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{dateLabel(notification.createdAt)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {notification.actionUrl ? (
                        <Link href={"/notifications/" + notification.id + "/open"} className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                      <form action={updateNotificationReadState}>
                        <input type="hidden" name="id" value={notification.id} />
                        <input type="hidden" name="isRead" value={notification.isRead ? "false" : "true"} />
                        <button className="h-9 rounded-md border border-border px-3 text-sm font-semibold text-muted hover:text-foreground">
                          Mark {notification.isRead ? "unread" : "read"}
                        </button>
                      </form>
                      <form action={deleteNotification} className="ml-auto">
                        <input type="hidden" name="id" value={notification.id} />
                        <ConfirmSubmitButton
                          message="Delete this notification permanently?"
                          className="grid h-9 w-9 place-items-center rounded-md border border-red-300 text-red-600"
                          aria-label="Delete notification"
                          title="Delete notification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <CheckCheck className="mx-auto h-6 w-6 text-accent" />
                <p className="mt-3 font-semibold">{unreadOnly ? "No unread notifications" : "No notifications yet"}</p>
              </div>
            )}
          </div>
        </section>

        <section className="self-start rounded-lg border border-border bg-background p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Reminder preferences</h2>
          </div>
          <form action={updateNotificationPreferences} className="mt-5 grid gap-4">
            {[
              ["taskDeadlines", "Task deadlines", preferences?.taskDeadlines ?? true],
              ["studySessions", "Study sessions", preferences?.studySessions ?? true],
              ["groupUpdates", "Study groups", preferences?.groupUpdates ?? true],
              ["goalDeadlines", "Goal deadlines", preferences?.goalDeadlines ?? true],
              ["qaAnswers", "Q&A answers", preferences?.qaAnswers ?? true],
            ].map(([name, label, checked]) => (
              <label key={String(name)} className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-3 text-sm font-medium">
                {label}
                <input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} className="h-4 w-4 accent-[var(--accent)]" />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-medium">
              Study session alert
              <select name="studySessionReminderMinutes" defaultValue={preferences?.studySessionReminderMinutes ?? 15} className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="5">5 minutes before</option>
                <option value="10">10 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
              </select>
            </label>
            <BrowserAlertSettings />
            <label className="grid gap-2 text-sm font-medium">
              Deadline reminder window
              <select name="reminderHours" defaultValue={preferences?.reminderHours ?? 24} className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="1">1 hour before</option>
                <option value="6">6 hours before</option>
                <option value="12">12 hours before</option>
                <option value="24">24 hours before</option>
                <option value="48">2 days before</option>
                <option value="72">3 days before</option>
                <option value="168">1 week before</option>
              </select>
            </label>
            <button className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Save preferences</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
