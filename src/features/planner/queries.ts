import "server-only";

import { prisma } from "@/server/db";
import { expireOverdueTasks } from "@/features/tasks/status";

export async function getPlannerData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { activeSemester: true },
  });
  const semesterId = user?.activeSemesterId;

  if (semesterId) await expireOverdueTasks(userId, semesterId);

  const activeEnrollments = semesterId
    ? await prisma.enrollment.findMany({
        where: { userId, semesterId },
        include: { course: true },
        orderBy: { course: { code: "asc" } },
      })
    : [];
  const activeCourseIds = activeEnrollments.map((enrollment) => enrollment.courseId);

  const [activeSemesterProfile, openTasks, timetable, studyPlans] = semesterId
    ? await Promise.all([
        prisma.semesterProfile.findUnique({
          where: { userId_semesterId: { userId, semesterId } },
        }),
        prisma.task.findMany({
          where: {
            userId,
            semesterId,
            status: "TODO",
          },
          include: { course: true },
          orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        }),
        prisma.timetableBlock.findMany({
          where: { userId, semesterId },
          include: { course: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        prisma.studyPlan.findMany({
          where: { userId, semesterId, status: { not: "ARCHIVED" } },
          include: {
            items: {
              where: {
                OR: [{ courseId: null }, { courseId: { in: activeCourseIds } }],
              },
              include: { course: true },
              orderBy: [{ status: "asc" }, { scheduledStart: "asc" }, { createdAt: "desc" }],
            },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
      ])
    : [null, [], [], []];

  const activeStudyPlan =
    studyPlans.find((plan) => plan.status === "ACTIVE") ?? studyPlans[0] ?? null;

  return {
    user,
    activeSemester: user?.activeSemester ?? null,
    activeSemesterProfile,
    activeEnrollments,
    openTasks,
    timetable,
    studyPlans,
    activeStudyPlan,
  };
}
