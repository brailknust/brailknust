import Link from "next/link";
import {
  AlarmClock,
  Bell,
  BookOpen,
  CheckCheck,
  Clock3,
  ClipboardCheck,
  ExternalLink,
  MessageSquare,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { BrowserAlertSettings } from "@/app/notifications/browser-alert-settings";
import { StudySessionPanel } from "@/app/notifications/study-session-panel";
import { requireAppUser } from "@/features/auth/queries";
import {
  deleteNotification,
  markAllNotificationsRead,
  updateNotificationPreferences,
  updateNotificationReadState,
} from "@/features/notifications/actions";
import { getNotificationCenterData, getStudySessionPanelData } from "@/features/notifications/queries";
import { isNotificationSyncStale, syncNotificationsForUser } from "@/features/notifications/service";
import { respondToAttendance } from "@/features/tracking/actions";
import { reconcileAcademicTracking } from "@/features/tracking/service";

type NotificationsPageProps = {
  searchParams: Promise<{ view?: string }>;
};

type CenterNotification = Awaited<ReturnType<typeof getNotificationCenterData>>["notifications"][number];

const sectionMeta = {
  ATTENDANCE: { label: "Attendance", icon: ClipboardCheck },
  STUDY_PLAN: { label: "Study & sessions", icon: BookOpen },
  DEADLINE: { label: "Deadlines", icon: AlarmClock },
  GROUP: { label: "Study groups", icon: Users },
  SYSTEM: { label: "System", icon: Settings2 },
} as const;
const sectionOrder = ["ATTENDANCE", "STUDY_PLAN", "DEADLINE", "GROUP", "SYSTEM"] as const;

const attendanceOptions = [
  { status: "ATTENDED", label: "Attended" },
  { status: "MISSED", label: "Missed" },
  { status: "CANCELLED", label: "Cancelled" },
  { status: "EXCUSED", label: "Excused" },
] as const;

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function NotificationCard({ notification }: { notification: CenterNotification }) {
  const isAttendance = notification.type === "ATTENDANCE";
  const attendanceResolved = isAttendance && notification.attendanceStatus && notification.attendanceStatus !== "UNCONFIRMED";

  return (
    <article className={`rounded-2xl border p-4 ${notification.isRead ? "border-border bg-white" : "border-accent/50 bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${notification.isRead ? "bg-surface text-muted" : "bg-accent text-white"}`}>
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

          {isAttendance && notification.attendanceRecordId ? (
            <div className="mt-4 grid gap-2">
              {attendanceResolved ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <CheckCheck className="h-3.5 w-3.5" /> Marked {notification.attendanceStatus?.toLowerCase()}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {attendanceOptions.map((option) => (
                    <form key={option.status} action={respondToAttendance}>
                      <input type="hidden" name="attendanceId" value={notification.attendanceRecordId!} />
                      <input type="hidden" name="status" value={option.status} />
                      <PendingSubmitButton pendingLabel="Saving..." className="h-9 rounded-xl border border-border px-3 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
                        {option.label}
                      </PendingSubmitButton>
                    </form>
                  ))}
                </div>
              )}
              {notification.actionUrl ? (
                <Link href={notification.actionUrl} className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-accent hover:underline">
                  <MessageSquare className="h-3.5 w-3.5" /> Share what you learnt in this course&apos;s AI chat
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isAttendance && notification.actionUrl ? (
              <Link href={"/notifications/" + notification.id + "/open"} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white">
                Open <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            <form action={updateNotificationReadState}>
              <input type="hidden" name="id" value={notification.id} />
              <input type="hidden" name="isRead" value={notification.isRead ? "false" : "true"} />
              <PendingSubmitButton pendingLabel="Updating..." className="h-9 rounded-xl border border-border px-3 text-sm font-semibold text-muted hover:text-foreground">
                Mark {notification.isRead ? "unread" : "read"}
              </PendingSubmitButton>
            </form>
            <form action={deleteNotification} className="ml-auto">
              <input type="hidden" name="id" value={notification.id} />
              <ConfirmSubmitButton
                message="Dismiss this notification? It will remain in your history."
                className="grid h-9 w-9 place-items-center rounded-xl border border-red-300 text-red-600"
                aria-label="Dismiss notification"
                title="Dismiss notification"
              >
                <Trash2 className="h-4 w-4" />
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { appUser } = await requireAppUser();
  const params = await searchParams;
  const view = ["active", "unread", "history", "missed"].includes(params.view ?? "") ? params.view! : "active";

  // reconcileAcademicTracking has no throttle of its own (it writes attendance
  // records and recomputes goal progress), so it's gated on the same window
  // syncNotificationsForUser uses internally. Without this, switching between
  // the Active/Unread/Missed/History tabs — each a fresh request — re-ran the
  // full reconciliation every time, which is what made tab switching slow.
  if (appUser.activeSemesterId && (await isNotificationSyncStale(appUser.id))) {
    await reconcileAcademicTracking(appUser.id, appUser.activeSemesterId);
  }
  await syncNotificationsForUser(appUser.id);

  const [data, studySessionData] = await Promise.all([
    getNotificationCenterData(appUser.id, view),
    getStudySessionPanelData(appUser.id, appUser.activeSemesterId),
  ]);
  const preferences = data.preferences;

  const sections = sectionOrder
    .map((type) => ({
      type,
      meta: sectionMeta[type],
      items: data.notifications.filter((notification) => notification.type === type),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <AppShell title="Notifications" eyebrow="Reminders">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/65">Notification center</p>
            <h2 className="mt-2 text-2xl font-semibold">{data.unreadCount} unread</h2>
            <p className="mt-2 text-sm text-white/70">Deadlines, study sessions, attendance, groups, and goals</p>
          </div>
          {data.unreadCount ? (
            <form action={markAllNotificationsRead}>
              <PendingSubmitButton className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-foreground" pendingLabel="Marking...">
                <CheckCheck className="h-4 w-4" /> Mark all as read
              </PendingSubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      <div id="study-session" className="mt-6 scroll-mt-6">
        <StudySessionPanel
          active={studySessionData.active}
          upcoming={studySessionData.upcoming}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section>
          <nav className="flex gap-2 border-b border-border">
            <Link href="/notifications" className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === "active" ? "border-accent text-accent" : "border-transparent text-muted"}`}>Active</Link>
            <Link href="/notifications?view=unread" className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === "unread" ? "border-accent text-accent" : "border-transparent text-muted"}`}>Unread</Link>
            <Link href="/notifications?view=missed" className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === "missed" ? "border-accent text-accent" : "border-transparent text-muted"}`}>Missed</Link>
            <Link href="/notifications?view=history" className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === "history" ? "border-accent text-accent" : "border-transparent text-muted"}`}>History</Link>
          </nav>

          <div className="mt-5 grid gap-6">
            {sections.length ? sections.map((section) => (
              <div key={section.type} className="grid gap-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <section.meta.icon className="h-3.5 w-3.5" /> {section.meta.label}
                </h3>
                {section.items.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} />
                ))}
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <CheckCheck className="mx-auto h-6 w-6 text-accent" />
                <p className="mt-3 font-semibold">No {view === "active" ? "active" : view} notifications</p>
              </div>
            )}
          </div>
        </section>

        <section className="self-start rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Reminder preferences</h2>
          </div>
          <form action={updateNotificationPreferences} className="mt-5 grid gap-4">
            {/* Study groups, goal deadlines, and Q&A answers are withheld
                from the deployed nav, so their reminder toggles are hidden
                here too. The fields still save through with their existing
                values so nothing breaks if those pages come back. */}
            {[
              ["taskDeadlines", "Task deadlines", preferences?.taskDeadlines ?? true],
              ["studySessions", "Study sessions", preferences?.studySessions ?? true],
            ].map(([name, label, checked]) => (
              <label key={String(name)} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium">
                {label}
                <input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} className="h-4 w-4 accent-[var(--accent)]" />
              </label>
            ))}
            <input type="hidden" name="groupUpdates" value={(preferences?.groupUpdates ?? true) ? "on" : "off"} />
            <input type="hidden" name="goalDeadlines" value={(preferences?.goalDeadlines ?? true) ? "on" : "off"} />
            <input type="hidden" name="qaAnswers" value={(preferences?.qaAnswers ?? true) ? "on" : "off"} />
            <label className="grid gap-2 text-sm font-medium">
              Study session reminders
              <select name="studySessionReminderMinutes" defaultValue={preferences?.studySessionReminderMinutes ?? 15} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
                <option value="5">5 minutes before</option>
                <option value="10">10 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Deadline reminders
              <select name="reminderHours" defaultValue={preferences?.reminderHours ?? 24} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
                <option value="1">1 hour before</option>
                <option value="6">6 hours before</option>
                <option value="12">12 hours before</option>
                <option value="24">24 hours before</option>
                <option value="48">2 days before</option>
                <option value="72">3 days before</option>
                <option value="168">1 week before</option>
              </select>
            </label>
            <BrowserAlertSettings />
            <PendingSubmitButton pendingLabel="Saving preferences..." className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Save preferences</PendingSubmitButton>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
