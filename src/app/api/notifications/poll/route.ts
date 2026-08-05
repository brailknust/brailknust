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
