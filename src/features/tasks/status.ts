import "server-only";

import { prisma } from "@/server/db";

const priorityRank = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;

const statusRank = {
  TODO: 0,
  IN_PROGRESS: 0,
  EXPIRED: 1,
  DONE: 2,
  ARCHIVED: 3,
} as const;

export async function expireOverdueTasks(userId: string, semesterId?: string) {
  await prisma.task.updateMany({
    where: {
      userId,
      ...(semesterId ? { semesterId } : {}),
      status: { in: ["TODO", "IN_PROGRESS"] },
      dueAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

export function sortTasksByImportanceAndDueDate<
  T extends {
    priority: keyof typeof priorityRank;
    status: keyof typeof statusRank;
    dueAt: Date | null;
    createdAt: Date;
  },
>(tasks: T[]) {
  return tasks.sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus) return byStatus;

    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    if (byPriority) return byPriority;

    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
