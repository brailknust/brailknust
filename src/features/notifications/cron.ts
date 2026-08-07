import "server-only";

import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { reconcileAcademicTracking } from "@/features/tracking/service";
import { prisma } from "@/server/db";

const batchSize = 100;
const retentionDays = 180;

export async function runNotificationCronBatch(cursor?: string) {
  const startedAt = Date.now();
  const users = await prisma.user.findMany({
    where: { activeSemesterId: { not: null }, deletedAt: null },
    select: { id: true, activeSemesterId: true },
    orderBy: { id: "asc" },
    take: batchSize,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let synced = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await syncNotificationsForUser(user.id, true);
      if (user.activeSemesterId) await syncGoalProgressSnapshots(user.id, user.activeSemesterId);
      if (user.activeSemesterId) await reconcileAcademicTracking(user.id, user.activeSemesterId);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error("Notification sync failed", { error });
    }
  }

  const retention = await prisma.notification.deleteMany({
    where: {
      status: { in: ["READ", "DISMISSED", "EXPIRED"] },
      createdAt: { lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000) },
    },
  });

  return {
    processed: users.length,
    synced,
    failed,
    retainedCleanupDeleted: retention.count,
    nextCursor: users.length === batchSize ? users.at(-1)?.id ?? null : null,
    durationMs: Date.now() - startedAt,
  };
}
