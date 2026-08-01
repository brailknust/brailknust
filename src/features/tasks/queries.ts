import "server-only";

import { prisma } from "@/server/db";

export async function getTasksPageData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true, activeSemester: true },
  });
  const semesterId = user?.activeSemesterId;

  const [tasks, courses] = semesterId
    ? await Promise.all([
        prisma.task.findMany({
          where: { userId, semesterId },
          include: { course: true },
          orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        }),
        prisma.course.findMany({
          where: { enrollments: { some: { userId, semesterId } } },
          orderBy: { code: "asc" },
        }),
      ])
    : [[], []];

  return {
    activeSemester: user?.activeSemester ?? null,
    tasks,
    courses,
  };
}
