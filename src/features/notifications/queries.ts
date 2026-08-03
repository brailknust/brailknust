import "server-only";

import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

export async function getNotificationCenterData(userId: string, unreadOnly = false) {
  await syncNotificationsForUser(userId);
  const [preferences, notifications, unreadCount] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { preferences, notifications, unreadCount };
}

export async function getDashboardNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unreadCount };
}
