import "server-only";

import { calculateAssessmentAverage } from "@/features/academics/calculations";
import { accraWeekBounds } from "@/features/academics/time";
import { shouldRecordGoalProgressSnapshot } from "@/features/goals/progress";
import { calculateCwaGoal, calculateManualGoal, calculateMasteryGoal, calculatePracticeQuestionGoal, calculateStudyTimeGoal } from "@/features/goals/calculators";
import { prisma } from "@/server/db";

function inRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end);
}

export async function syncGoalProgressSnapshots(userId: string, semesterId: string) {
  try {
    const [profile, goals, tasks, studyItems, assessments, masteries, attempts] = await Promise.all([
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
      prisma.topicMastery.findMany({ where: { userId, enrollment: { semesterId } }, select: { enrollment: { select: { courseId: true } }, masteryScore: true } }),
      prisma.diagnosticAttempt.findMany({ where: { userId, question: { quiz: { enrollment: { semesterId } } } }, select: { answeredAt: true, question: { select: { quiz: { select: { enrollment: { select: { courseId: true } } } } } } } }),
    ]);

    const { start, end } = accraWeekBounds();
    const calculatedByGoal = new Map<string, ReturnType<typeof calculateManualGoal>>();
    const snapshots = goals.flatMap((goal) => {
      const weekly = goal.period === "WEEKLY";
      const courseMatches = (courseId: string | null) => !goal.courseId || courseId === goal.courseId;
      let calculated = calculateManualGoal(Number(goal.currentValue), Number(goal.targetValue));
      if (goal.metric === "CWA") {
        calculated = calculateCwaGoal(Number(profile?.cwa ?? 0), Number(goal.targetValue));
      } else if (goal.metric === "TASKS_COMPLETED") {
        calculated = calculateManualGoal(tasks.filter((task) =>
          courseMatches(task.courseId) && (!weekly || inRange(task.updatedAt, start, end))
        ).length, Number(goal.targetValue));
      } else if (goal.metric === "STUDY_MINUTES") {
        const minutes = studyItems
          .filter((item) =>
            courseMatches(item.courseId) && (!weekly || inRange(item.scheduledStart, start, end))
          )
          .reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
        calculated = calculateStudyTimeGoal(minutes, Number(goal.targetValue));
      } else if (goal.metric === "ASSESSMENT_AVERAGE") {
        calculated = calculateManualGoal(calculateAssessmentAverage(assessments.filter((item) =>
          courseMatches(item.courseId) && (!weekly || inRange(item.assessedAt ?? item.createdAt, start, end))
        )), Number(goal.targetValue));
      } else if (goal.metric === "COURSE_MASTERY") {
        const scores = masteries.filter((item) => courseMatches(item.enrollment.courseId)).map((item) => Number(item.masteryScore));
        const relevantAssessments = assessments.filter((item) => courseMatches(item.courseId));
        calculated = calculateMasteryGoal(scores, relevantAssessments.map((item) => ({ score: Number(item.score), maxScore: Number(item.maxScore), weight: item.weight ? Number(item.weight) : null })), Number(goal.targetValue));
      } else if (goal.metric === "QUESTIONS_COMPLETED") {
        const completed = attempts.filter((item) => courseMatches(item.question.quiz.enrollment.courseId) && (!weekly || inRange(item.answeredAt, start, end))).length;
        calculated = calculatePracticeQuestionGoal(completed, Number(goal.targetValue));
      }
      const progress = calculated;
      calculatedByGoal.set(goal.id, progress);
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
    const transitions: { userId: string; semesterId: string; title: string; message: string; type: "SYSTEM"; actionUrl: string; sourceKey: string; scheduledFor: Date; deliveredAt: Date; status: "DELIVERED"; channel: "IN_APP" }[] = [];
    for (const goal of goals) {
      if (goal.metric === "MANUAL" || goal.status === "ARCHIVED" || goal.status === "PAUSED") continue;
      const calculated = calculatedByGoal.get(goal.id);
      if (!calculated) continue;
      const now = new Date();
      const nextStatus = goal.deadline && goal.deadline < now && !calculated.targetReached ? "MISSED" : calculated.targetReached ? "COMPLETED" : "ACTIVE";
      if (nextStatus !== goal.status) {
        await prisma.goal.update({ where: { id: goal.id }, data: { status: nextStatus } });
        if (nextStatus === "COMPLETED" || nextStatus === "MISSED") transitions.push({ userId, semesterId, title: nextStatus === "COMPLETED" ? "Goal completed" : "Goal missed", message: nextStatus === "COMPLETED" ? `You reached your goal: ${goal.title}.` : `${goal.title} passed its deadline before completion.`, type: "SYSTEM", actionUrl: "/goals", sourceKey: `${nextStatus === "COMPLETED" ? "goal-reached" : "goal-missed"}:${goal.id}:${goal.period === "WEEKLY" ? start.toISOString() : goal.deadline?.toISOString() ?? "semester"}`, scheduledFor: now, deliveredAt: now, status: "DELIVERED", channel: "IN_APP" });
      }
    }
    if (transitions.length) await prisma.notification.createMany({ data: transitions, skipDuplicates: true });
  } catch (error) {
    console.error("Failed to sync goal progress snapshots", error);
  }
}
