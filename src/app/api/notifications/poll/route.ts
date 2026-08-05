import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export async function GET() {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "notification-poll", limit: 60, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: appUser.id,
      isRead: false,
      status: { in: ["PENDING", "DELIVERED"] },
      OR: [
        { type: "STUDY_PLAN", sourceKey: { startsWith: "study-session-close:" } },
        { type: "DEADLINE", sourceKey: { startsWith: "task-reminder:" } },
      ],
      scheduledFor: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, message: true },
  });

  return Response.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      openUrl: `/notifications/${notification.id}/open`,
      actionLabel: notification.title === "Task reminder" ? "Open task" : "Open session",
    })),
  });
}
