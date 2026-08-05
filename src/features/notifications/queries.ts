import "server-only";

import { prisma } from "@/server/db";

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false, status: { in: ["PENDING", "DELIVERED"] } },
  });
}

export async function getNotificationCenterData(userId: string, view = "active") {
  const [preferences, notifications, unreadCount] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId, ...(view === "unread" ? { isRead: false, status: { in: ["PENDING", "DELIVERED"] } } : view === "history" ? { status: { in: ["READ", "DISMISSED"] } } : view === "missed" ? { status: "EXPIRED" } : { status: { in: ["PENDING", "DELIVERED"] } }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, isRead: false, status: { in: ["PENDING", "DELIVERED"] } } }),
  ]);
  return { preferences, notifications, unreadCount };
}

export async function getDashboardNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, status: { in: ["PENDING", "DELIVERED"] } },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.notification.count({ where: { userId, isRead: false, status: { in: ["PENDING", "DELIVERED"] } } }),
  ]);
  return { items, unreadCount };
}
