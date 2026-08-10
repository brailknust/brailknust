import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { reconcileAcademicTracking } from "@/features/tracking/service";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

// Matches syncThrottleMs in features/notifications/service.ts. reconcileAcademicTracking
// has no throttle of its own, so this gate is what keeps it from re-scanning every
// timetable block on every single poll.
const regenerateThrottleMs = 60 * 1000;

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
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: appUser.id },
    select: { lastSyncedAt: true },
  });
  const isStale = !preference?.lastSyncedAt || Date.now() - preference.lastSyncedAt.getTime() >= regenerateThrottleMs;
  if (isStale) {
    if (appUser.activeSemesterId) {
      await reconcileAcademicTracking(appUser.id, appUser.activeSemesterId);
    }
    await syncNotificationsForUser(appUser.id);
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: appUser.id,
      isRead: false,
      status: { in: ["PENDING", "DELIVERED"] },
      scheduledFor: { lte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, message: true, actionUrl: true },
  });

  return Response.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      openUrl: notification.actionUrl ? `/notifications/${notification.id}/open` : "/notifications",
      actionLabel: "Open",
    })),
  });
}
