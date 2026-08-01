import "server-only";
import { prisma } from "@/server/db";

export async function getPerformanceData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true, activeSemester: true },
  });
  if (!user?.activeSemesterId) return { activeSemester: null, profile: null, enrollments: [], tasks: [], studyItems: [], weakAreas: [], assessments: [], cwaSnapshots: [] };

  const semesterId = user.activeSemesterId;
  const [profile, enrollments, tasks, studyItems, weakAreas, assessments, cwaSnapshots] = await Promise.all([
    prisma.semesterProfile.findUnique({ where: { userId_semesterId: { userId, semesterId } } }),
    prisma.enrollment.findMany({ where: { userId, semesterId }, include: { course: true }, orderBy: { course: { code: "asc" } } }),
    prisma.task.findMany({ where: { userId, semesterId }, select: { id: true, courseId: true, status: true } }),
    prisma.studyPlanItem.findMany({ where: { studyPlan: { userId, semesterId, status: { not: "ARCHIVED" } } }, select: { id: true, courseId: true, status: true, durationMinutes: true } }),
    prisma.weakArea.findMany({ where: { userId, semesterId }, include: { course: true }, orderBy: [{ weaknessScore: "desc" }, { updatedAt: "desc" }] }),
    prisma.assessment.findMany({ where: { userId, semesterId }, include: { course: true }, orderBy: [{ assessedAt: "asc" }, { createdAt: "asc" }] }),
    prisma.cwaSnapshot.findMany({ where: { userId, semesterId }, orderBy: { recordedAt: "asc" }, take: 20 }),
  ]);
  return { activeSemester: user.activeSemester, profile, enrollments, tasks, studyItems, weakAreas, assessments, cwaSnapshots };
}
