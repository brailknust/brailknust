import "server-only";

import { prisma } from "@/server/db";
import { calculateAssessmentAverage } from "@/features/academics/calculations";
import { accraWeekBounds } from "@/features/academics/time";
import { calculateGoalProgress } from "@/features/goals/progress";
import { calculateCwaGoal, calculateMasteryGoal, calculatePracticeQuestionGoal, calculateStudyTimeGoal } from "@/features/goals/calculators";

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
  const [profile, enrollments, goals, tasks, studyItems, assessments, masteries, attempts] = await Promise.all([
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
      include: {
        course: true,
        progressSnapshots: {
          orderBy: { recordedAt: "desc" },
          take: 6,
        },
      },
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
      select: { courseId: true, score: true, maxScore: true, weight: true, assessedAt: true, createdAt: true },
    }),
    prisma.topicMastery.findMany({ where: { userId, enrollment: { semesterId } }, select: { enrollment: { select: { courseId: true } }, masteryScore: true } }),
    prisma.diagnosticAttempt.findMany({
      where: { userId, question: { quiz: { enrollment: { semesterId } } } },
      select: { answeredAt: true, question: { select: { quiz: { select: { enrollment: { select: { courseId: true } } } } } } },
    }),
  ]);

  const { start, end } = accraWeekBounds();
  const calculatedGoals = goals.map((goal) => {
    const weekly = goal.period === "WEEKLY";
    const courseMatches = (courseId: string | null) => !goal.courseId || courseId === goal.courseId;
    let current = Number(goal.currentValue);
    let evidence = "Updated from your saved academic records.";

    if (goal.metric === "CWA") {
      const result = calculateCwaGoal(Number(profile?.cwa ?? 0), Number(goal.targetValue)); current = result.currentValue; evidence = result.evidence;
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
      evidence = calculateStudyTimeGoal(current, Number(goal.targetValue), goal.course?.code).evidence;
    } else if (goal.metric === "ASSESSMENT_AVERAGE") {
      const relevant = assessments.filter((item) =>
        courseMatches(item.courseId) &&
        (!weekly || inRange(item.assessedAt ?? item.createdAt, start, end))
      );
      current = calculateAssessmentAverage(relevant);
    } else if (goal.metric === "COURSE_MASTERY") {
      const result = calculateMasteryGoal(masteries.filter((item) => courseMatches(item.enrollment.courseId)).map((item) => Number(item.masteryScore)), assessments.filter((item) => courseMatches(item.courseId)).map((item) => ({ score: Number(item.score), maxScore: Number(item.maxScore), weight: item.weight ? Number(item.weight) : null })), Number(goal.targetValue));
      current = result.currentValue; evidence = result.evidence;
    } else if (goal.metric === "QUESTIONS_COMPLETED") {
      current = attempts.filter((item) => courseMatches(item.question.quiz.enrollment.courseId) && (!weekly || inRange(item.answeredAt, start, end))).length;
      evidence = calculatePracticeQuestionGoal(current, Number(goal.targetValue)).evidence;
    }

    const progress = calculateGoalProgress(current, Number(goal.targetValue));
    return {
      ...goal,
      currentValue: progress.currentValue,
      storedCurrentValue: Number(goal.currentValue),
      targetValue: progress.targetValue,
      progress: progress.progress,
      targetReached: progress.targetReached,
      evidence,
    };
  });

  return {
    activeSemester: user.activeSemester,
    profile,
    courses: enrollments.map((item) => item.course),
    goals: calculatedGoals,
  };
}
