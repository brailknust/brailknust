import "server-only";

import { prisma } from "@/server/db";
import { withEffectiveTaskStatus } from "@/features/tasks/status";

export async function getAcademicSetup(userId: string) {
  const [user, semesters, courses, enrollments, timetable] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { activeSemester: true } }),
    prisma.semester.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { OR: [{ approvalStatus: "OFFICIAL" }, { createdById: userId }] },
      orderBy: { code: "asc" },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      include: { course: true, semester: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.timetableBlock.findMany({
      where: { userId },
      include: { course: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const sortedSemesters = user?.activeSemesterId
    ? [
        ...semesters.filter((semester) => semester.id === user.activeSemesterId),
        ...semesters.filter((semester) => semester.id !== user.activeSemesterId),
      ]
    : semesters;

  return {
    user,
    activeSemester: user?.activeSemester ?? null,
    activeSemesterEnrollments: user?.activeSemesterId
      ? enrollments.filter((enrollment) => enrollment.semesterId === user.activeSemesterId)
      : [],
    semesters: sortedSemesters,
    courses,
    enrollments,
    timetable: user?.activeSemesterId
      ? timetable.filter((block) => block.semesterId === user.activeSemesterId)
      : [],
  };
}

export async function getActiveSemesterSummary(userId: string, activeSemesterId: string | null) {
  if (!activeSemesterId) return null;

  return prisma.semester.findFirst({
    where: { id: activeSemesterId, ownerId: userId },
    select: { id: true, name: true, academicYear: true, level: true, term: true },
  });
}

export async function getSemesterCards(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true },
  });
  const semesters = await prisma.semester.findMany({
    where: { ownerId: userId },
    include: {
      profiles: { where: { userId } },
      enrollments: { where: { userId }, include: { course: true } },
    },
    orderBy: [{ academicYear: "desc" }, { level: "asc" }, { term: "asc" }],
  });
  const semesterIds = semesters.map((semester) => semester.id);

  const tasks = semesterIds.length
    ? await prisma.task.findMany({
        where: {
          userId,
          semesterId: { in: semesterIds },
          status: "TODO",
          OR: [{ dueAt: null }, { dueAt: { gte: new Date() } }],
        },
        select: { semesterId: true },
      })
    : [];

  return semesters.map((semester) => ({
    ...semester,
    profile: semester.profiles[0] ?? null,
    isActiveForUser: user?.activeSemesterId === semester.id,
    openTaskCount: tasks.filter((task) => task.semesterId === semester.id).length,
  })).sort((left, right) =>
    Number(right.isActiveForUser) - Number(left.isActiveForUser));
}

export async function getSemesterDetail(userId: string, semesterId: string) {
  const [user, semester, courses, profile, enrollments, timetable] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { activeSemesterId: true } }),
    prisma.semester.findFirst({
      where: { id: semesterId, ownerId: userId },
    }),
    prisma.course.findMany({
      where: { OR: [{ approvalStatus: "OFFICIAL" }, { createdById: userId }] },
      orderBy: { code: "asc" },
    }),
    prisma.semesterProfile.findUnique({
      where: { userId_semesterId: { userId, semesterId } },
    }),
    prisma.enrollment.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.timetableBlock.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const [tasks, studyItems] = await Promise.all([
    prisma.task.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.studyPlanItem.findMany({
      where: {
        studyPlan: { userId, semesterId, status: { not: "ARCHIVED" } },
      },
      include: { course: true, studyPlan: true },
      orderBy: [{ status: "asc" }, { scheduledStart: "asc" }],
    }),
  ]);

  return {
    user,
    semester,
    profile,
    courses,
    enrollments,
    tasks: tasks.map((task) => withEffectiveTaskStatus(task)),
    studyItems,
    timetable,
    isActiveForUser: user?.activeSemesterId === semesterId,
  };
}

export async function getCourseAnalytics(userId: string, semesterId: string, courseId: string) {
  const routeIdentifier = decodeURIComponent(courseId).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(routeIdentifier);
  const [enrollment, user] = await Promise.all([
    prisma.enrollment.findFirst({
      where: {
        userId,
        semesterId,
        OR: isUuid
          ? [{ courseId: routeIdentifier }, { id: routeIdentifier }]
          : [{ course: { code: routeIdentifier.toUpperCase() } }],
      },
      include: { course: true, semester: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { activeSemesterId: true },
    }),
  ]);

  if (!enrollment) return null;
  const resolvedCourseId = enrollment.courseId;

  const [tasks, studyItems, weakAreas, timetable, assessments, materials, topics] = await Promise.all([
    prisma.task.findMany({
      where: { userId, semesterId, courseId: resolvedCourseId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.studyPlanItem.findMany({
      where: {
        courseId: resolvedCourseId,
        studyPlan: { userId, semesterId, status: "ACTIVE" },
      },
      include: { studyPlan: true },
      orderBy: [{ status: "asc" }, { scheduledStart: "asc" }],
    }),
    prisma.weakArea.findMany({
      where: { userId, semesterId, courseId: resolvedCourseId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.timetableBlock.findMany({
      where: { userId, semesterId, courseId: resolvedCourseId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.assessment.findMany({
      where: { userId, semesterId, courseId: resolvedCourseId },
      orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.courseMaterial.findMany({
      where: { enrollmentId: enrollment.id },
      include: {
        chunks: {
          select: { topic: { select: { title: true } } },
          take: 1,
        },
        _count: { select: { chunks: true } },
        ingestionAttempts: {
          orderBy: { attempt: "desc" },
          take: 1,
          select: { attempt: true, status: true, chunkCount: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.courseTopic.findMany({
      where: { enrollmentId: enrollment.id },
      orderBy: [{ sequence: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    enrollment,
    tasks: tasks.map((task) => withEffectiveTaskStatus(task)),
    studyItems,
    weakAreas,
    timetable,
    assessments,
    materials,
    topics,
    completedTaskCount: tasks.filter((task) => task.status === "DONE").length,
    openTaskCount: tasks.filter(
      (task) => task.status === "TODO" && (!task.dueAt || task.dueAt >= new Date()),
    ).length,
    completedStudyItemCount: studyItems.filter((item) => item.status === "DONE").length,
    isActiveSemester: user?.activeSemesterId === semesterId,
  };
}
