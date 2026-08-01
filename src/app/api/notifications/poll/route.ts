import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";

export async function GET() {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  await syncNotificationsForUser(appUser.id);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: appUser.id,
      isRead: false,
      type: "STUDY_PLAN",
      sourceKey: { startsWith: "study-session-close:" },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, message: true },
  });

  return Response.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      openUrl: `/notifications/${notification.id}/open`,
    })),
  });
}
