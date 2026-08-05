import "server-only";

import { calculateAssessmentAverage } from "@/features/academics/calculations";
import { accraWeekBounds } from "@/features/academics/time";
import { calculateGoalProgress, shouldRecordGoalProgressSnapshot } from "@/features/goals/progress";
import { prisma } from "@/server/db";

function inRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end);
}

export async function syncGoalProgressSnapshots(userId: string, semesterId: string) {
  try {
    const [profile, goals, tasks, studyItems, assessments] = await Promise.all([
      prisma.semesterProfile.findUnique({ where: { userId_semesterId: { userId, semesterId } } }),
      prisma.goal.findMany({
        where: { userId, semesterId, status: { not: "ARCHIVED" } },
        include: {
          progressSnapshots: {
            orderBy: { recordedAt: "desc" },
            take: 1,
          },
        },
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
    ]);

    const { start, end } = accraWeekBounds();
    const snapshots = goals.flatMap((goal) => {
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
        current = calculateAssessmentAverage(assessments.filter((item) =>
          courseMatches(item.courseId) && (!weekly || inRange(item.assessedAt ?? item.createdAt, start, end))
        ));
      }

      const progress = calculateGoalProgress(current, Number(goal.targetValue));
      const latest = goal.progressSnapshots[0]
        ? {
            currentValue: Number(goal.progressSnapshots[0].currentValue),
            targetValue: Number(goal.progressSnapshots[0].targetValue),
            progress: goal.progressSnapshots[0].progress,
            metric: goal.progressSnapshots[0].metric,
          }
        : null;
      const next = {
        currentValue: progress.currentValue,
        targetValue: progress.targetValue,
        progress: progress.progress,
        metric: goal.metric,
      };

      return shouldRecordGoalProgressSnapshot(latest, next)
        ? [{
            userId,
            semesterId,
            goalId: goal.id,
            ...next,
          }]
        : [];
    });

    if (snapshots.length) {
      await prisma.goalProgressSnapshot.createMany({ data: snapshots });
    }
  } catch (error) {
    console.error("Failed to sync goal progress snapshots", error);
  }
}
