import "server-only";

import { prisma } from "@/server/db";

export async function getAcademicSetup(userId: string) {
  const [user, semesters, courses, enrollments, timetable] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { activeSemester: true } }),
    prisma.semester.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({ orderBy: { code: "asc" } }),
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
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });
  const semesterIds = semesters.map((semester) => semester.id);
  const tasks = semesterIds.length
    ? await prisma.task.findMany({
        where: {
          userId,
          semesterId: { in: semesterIds },
          status: { notIn: ["DONE", "ARCHIVED"] },
        },
        select: { semesterId: true },
      })
    : [];

  return semesters.map((semester) => ({
    ...semester,
    profile: semester.profiles[0] ?? null,
    isActiveForUser: user?.activeSemesterId === semester.id,
    openTaskCount: tasks.filter((task) => task.semesterId === semester.id).length,
  }));
}

export async function getSemesterDetail(userId: string, semesterId: string) {
  const [user, semester, courses, profile, enrollments, timetable] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { activeSemesterId: true } }),
    prisma.semester.findFirst({
      where: { id: semesterId, ownerId: userId },
    }),
    prisma.course.findMany({ orderBy: { code: "asc" } }),
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
    tasks,
    studyItems,
    timetable,
    isActiveForUser: user?.activeSemesterId === semesterId,
  };
}

export async function getCourseAnalytics(userId: string, semesterId: string, courseId: string) {
  const [enrollment, user] = await Promise.all([
    prisma.enrollment.findFirst({
      where: { userId, semesterId, courseId },
      include: { course: true, semester: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { activeSemesterId: true },
    }),
  ]);

  if (!enrollment) return null;

  const [tasks, studyItems, weakAreas, timetable, assessments, materials, topics] = await Promise.all([
    prisma.task.findMany({
      where: { userId, semesterId, courseId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.studyPlanItem.findMany({
      where: {
        courseId,
        studyPlan: { userId, semesterId, status: "ACTIVE" },
      },
      include: { studyPlan: true },
      orderBy: [{ status: "asc" }, { scheduledStart: "asc" }],
    }),
    prisma.weakArea.findMany({
      where: { userId, semesterId, courseId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.timetableBlock.findMany({
      where: { userId, semesterId, courseId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.assessment.findMany({
      where: { userId, semesterId, courseId },
      orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.courseMaterial.findMany({
      where: { enrollmentId: enrollment.id, status: { not: "ARCHIVED" } },
      include: {
        chunks: {
          select: { topic: { select: { title: true } } },
          take: 1,
        },
        _count: { select: { chunks: true } },
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
    tasks,
    studyItems,
    weakAreas,
    timetable,
    assessments,
    materials,
    topics,
    completedTaskCount: tasks.filter((task) => task.status === "DONE").length,
    openTaskCount: tasks.filter((task) => task.status !== "DONE" && task.status !== "ARCHIVED").length,
    completedStudyItemCount: studyItems.filter((item) => item.status === "DONE").length,
    isActiveSemester: user?.activeSemesterId === semesterId,
  };
}
