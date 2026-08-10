import "server-only";

import { prisma } from "@/server/db";
import { getActiveStudySession, getUpcomingStudyPlanItems } from "@/features/tracking/service";

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false, status: { in: ["PENDING", "DELIVERED"] } },
  });
}

// Attendance notifications don't store the AttendanceRecord id directly —
// their sourceKey ("attendance:{timetableBlockId}:{classDate}") already
// uniquely identifies the record via AttendanceRecord's own unique index,
// so we resolve it here instead of adding a redundant column.
async function attachAttendanceRecords<T extends { id: string; type: string; sourceKey: string | null }>(
  userId: string,
  notifications: T[],
): Promise<Array<T & { attendanceRecordId: string | null; attendanceStatus: string | null }>> {
  const keys = notifications
    .filter((notification) => notification.type === "ATTENDANCE" && notification.sourceKey)
    .map((notification) => {
      const [, timetableBlockId, classDate] = notification.sourceKey!.split(":");
      return { sourceKey: notification.sourceKey!, timetableBlockId, classDate };
    });

  if (!keys.length) {
    return notifications.map((notification) => ({ ...notification, attendanceRecordId: null, attendanceStatus: null }));
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      userId,
      OR: keys.map((key) => ({ timetableBlockId: key.timetableBlockId, classDate: new Date(key.classDate) })),
    },
    select: { id: true, timetableBlockId: true, classDate: true, status: true },
  });

  const bySourceKey = new Map<string, { id: string; status: string }>();
  for (const key of keys) {
    const match = records.find(
      (record) => record.timetableBlockId === key.timetableBlockId
        && record.classDate.toISOString().slice(0, 10) === key.classDate,
    );
    if (match) bySourceKey.set(key.sourceKey, { id: match.id, status: match.status });
  }

  return notifications.map((notification) => {
    const match = notification.sourceKey ? bySourceKey.get(notification.sourceKey) : undefined;
    return { ...notification, attendanceRecordId: match?.id ?? null, attendanceStatus: match?.status ?? null };
  });
}

export async function getNotificationCenterData(userId: string, view = "active") {
  const [preferences, rawNotifications, unreadCount] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId, ...(view === "unread" ? { isRead: false, status: { in: ["PENDING", "DELIVERED"] } } : view === "history" ? { status: { in: ["READ", "DISMISSED"] } } : view === "missed" ? { status: "EXPIRED" } : { status: { in: ["PENDING", "DELIVERED"] } }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId, isRead: false, status: { in: ["PENDING", "DELIVERED"] } } }),
  ]);
  const notifications = await attachAttendanceRecords(userId, rawNotifications);
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

export async function getStudySessionPanelData(userId: string, semesterId: string | null) {
  if (!semesterId) return { active: null, upcoming: [] };
  const [active, upcoming] = await Promise.all([
    getActiveStudySession(userId),
    getUpcomingStudyPlanItems(userId, semesterId),
  ]);
  return { active, upcoming };
}
