import "server-only";

import { prisma } from "@/server/db";

function weekBounds() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function inRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end);
}

export async function getGoalsPageData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true, activeSemester: true },
  });

  if (!user?.activeSemesterId) {
    return { activeSemester: null, profile: null, courses: [], goals: [] };
  }

  const semesterId = user.activeSemesterId;
  const [profile, enrollments, goals, tasks, studyItems, assessments] = await Promise.all([
    prisma.semesterProfile.findUnique({
      where: { userId_semesterId: { userId, semesterId } },
    }),
    prisma.enrollment.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.goal.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    }),
    prisma.task.findMany({
      where: { userId, semesterId, status: "DONE" },
      select: { courseId: true, updatedAt: true },
    }),
    prisma.studyPlanItem.findMany({
      where: {
        status: "DONE",
        studyPlan: { userId, semesterId, status: { not: "ARCHIVED" } },
      },
      select: { courseId: true, durationMinutes: true, scheduledStart: true },
    }),
    prisma.assessment.findMany({
      where: { userId, semesterId },
      select: { courseId: true, score: true, maxScore: true, assessedAt: true, createdAt: true },
    }),
  ]);

  const { start, end } = weekBounds();
  const calculatedGoals = goals.map((goal) => {
    const weekly = goal.period === "WEEKLY";
    const courseMatches = (courseId: string | null) => !goal.courseId || courseId === goal.courseId;
    let current = Number(goal.currentValue);

    if (goal.metric === "CWA") {
      current = Number(profile?.cwa ?? 0);
    } else if (goal.metric === "TASKS_COMPLETED") {
      current = tasks.filter((task) =>
        courseMatches(task.courseId) && (!weekly || inRange(task.updatedAt, start, end))
      ).length;
    } else if (goal.metric === "STUDY_MINUTES") {
      current = studyItems
        .filter((item) =>
          courseMatches(item.courseId) && (!weekly || inRange(item.scheduledStart, start, end))
        )
        .reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
    } else if (goal.metric === "ASSESSMENT_AVERAGE") {
      const relevant = assessments.filter((item) =>
        courseMatches(item.courseId) &&
        (!weekly || inRange(item.assessedAt ?? item.createdAt, start, end))
      );
      current = relevant.length
        ? relevant.reduce((sum, item) => sum + Number(item.score) / Number(item.maxScore) * 100, 0) / relevant.length
        : 0;
    }

    const target = Number(goal.targetValue);
    const progress = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0;
    return {
      ...goal,
      currentValue: Math.round(current * 10) / 10,
      storedCurrentValue: Number(goal.currentValue),
      targetValue: target,
      progress,
      targetReached: current >= target,
    };
  });

  return {
    activeSemester: user.activeSemester,
    profile,
    courses: enrollments.map((item) => item.course),
    goals: calculatedGoals,
  };
}
