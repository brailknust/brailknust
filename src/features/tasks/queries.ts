import "server-only";

import { prisma } from "@/server/db";
import { sortTasksByImportanceAndDueDate, withEffectiveTaskStatus } from "@/features/tasks/status";

export async function getTasksPageData(userId: string, semesterId: string | null) {
  const [activeSemester, tasks, courses] = semesterId
    ? await Promise.all([
        prisma.semester.findFirst({
          where: { id: semesterId, ownerId: userId },
        }),
        prisma.task.findMany({
          where: { userId, semesterId },
          include: { course: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.course.findMany({
          where: { enrollments: { some: { userId, semesterId } } },
          orderBy: { code: "asc" },
        }),
      ])
    : [null, [], []];

  return {
    activeSemester,
    tasks: sortTasksByImportanceAndDueDate(tasks.map((task) => withEffectiveTaskStatus(task))),
    courses,
  };
}

export async function getDashboardTasks(userId: string, semesterId: string | null) {
  if (!semesterId) return [];

  const tasks = await prisma.task.findMany({
    where: { userId, semesterId },
    include: { course: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return sortTasksByImportanceAndDueDate(
    tasks.map((task) => withEffectiveTaskStatus(task)),
  );
}
