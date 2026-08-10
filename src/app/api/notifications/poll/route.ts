import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { isNotificationSyncStale, syncNotificationsForUser } from "@/features/notifications/service";
import { getActiveStudySession, reconcileAcademicTracking } from "@/features/tracking/service";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export async function GET() {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "notification-poll", limit: 60, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  // The bell/poller only ever read rows here — nothing else regenerates "nearing"
  // reminders for a user who isn't on the /notifications page. Do it here too, on
  // the same throttle window syncNotificationsForUser already uses internally, so
  // reminders stay fresh for anyone with the app open anywhere.
  if (await isNotificationSyncStale(appUser.id)) {
    if (appUser.activeSemesterId) {
      await reconcileAcademicTracking(appUser.id, appUser.activeSemesterId);
    }
    await syncNotificationsForUser(appUser.id);
  }

  const [notifications, unreadCount, activeStudySession] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: appUser.id,
        isRead: false,
        status: { in: ["PENDING", "DELIVERED"] },
        scheduledFor: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, message: true, actionUrl: true, createdAt: true },
    }),
    // Powers the "N unread" counts shown in the bell and the dashboard
    // notifications card — both poll this route so they stay in sync.
    prisma.notification.count({
      where: {
        userId: appUser.id,
        isRead: false,
        status: { in: ["PENDING", "DELIVERED"] },
        scheduledFor: { lte: new Date() },
      },
    }),
    getActiveStudySession(appUser.id),
  ]);

  return Response.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      isRead: false,
      openUrl: notification.actionUrl ? `/notifications/${notification.id}/open` : "/notifications",
      actionLabel: "Open",
    })),
    unreadCount,
    activeStudySession: activeStudySession?.startedAt
      ? {
          id: activeStudySession.id,
          startedAt: activeStudySession.startedAt,
          title:
            activeStudySession.studyPlanItem?.title.split("||")[0]?.trim() ??
            activeStudySession.course?.name ??
            "Study session",
        }
      : null,
  });
}
