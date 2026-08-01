import "server-only";

import { prisma } from "@/server/db";

const syncThrottleMs = 5 * 60 * 1000;

function mondayBasedDay(value: Date) {
  return (value.getUTCDay() + 6) % 7;
}

function nextWeeklyOccurrence(template: Date, now: Date) {
  const occurrence = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      template.getUTCHours(),
      template.getUTCMinutes(),
    ),
  );
  const daysAhead = (mondayBasedDay(template) - mondayBasedDay(now) + 7) % 7;
  occurrence.setUTCDate(occurrence.getUTCDate() + daysAhead);

  if (occurrence <= now) {
    occurrence.setUTCDate(occurrence.getUTCDate() + 7);
  }

  return occurrence;
}

function plannerUrl(planId: string, occurrence: Date) {
  return `/planner?planId=${planId}&day=${mondayBasedDay(occurrence)}#study-timetable`;
}

export async function syncNotificationsForUser(userId: string, force = false) {
  const preference = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const now = new Date();
  if (
    !force &&
    preference.lastSyncedAt &&
    now.getTime() - preference.lastSyncedAt.getTime() < syncThrottleMs
  ) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true, activeSemester: { select: { academicYear: true, level: true, term: true } } },
  });
  if (!user?.activeSemesterId || !user.activeSemester) {
    await prisma.notificationPreference.update({
      where: { userId },
      data: { lastSyncedAt: now },
    });
    return;
  }

  const semesterId = user.activeSemesterId;
  const deadlineEnd = new Date(now.getTime() + preference.reminderHours * 60 * 60 * 1000);
  const studySessionEnd = new Date(now.getTime() + preference.studySessionReminderMinutes * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [tasks, studyItems, goals, groups] = await Promise.all([
    preference.taskDeadlines
      ? prisma.task.findMany({
          where: {
            userId,
            semesterId,
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueAt: { gte: now, lte: deadlineEnd },
          },
          select: { id: true, title: true, dueAt: true, course: { select: { name: true } } },
        })
      : [],
    preference.studySessions
      ? prisma.studyPlanItem.findMany({
          where: {
            status: { not: "ARCHIVED" },
            scheduledStart: { not: null },
            studyPlan: { userId, semesterId, status: { not: "ARCHIVED" } },
          },
          select: {
            id: true,
            title: true,
            scheduledStart: true,
            course: { select: { name: true } },
            studyPlan: { select: { id: true } },
          },
        })
      : [],
    preference.goalDeadlines
      ? prisma.goal.findMany({
          where: {
            userId,
            semesterId,
            status: "ACTIVE",
            deadline: { gte: startOfToday, lte: deadlineEnd },
          },
          select: { id: true, title: true, deadline: true },
        })
      : [],
    preference.groupUpdates
      ? prisma.studyGroup.findMany({
          where: {
            semester: {
              academicYear: user.activeSemester.academicYear,
              level: user.activeSemester.level,
              term: user.activeSemester.term,
            },
            meetingAt: { gte: now, lte: deadlineEnd },
            members: { some: { userId } },
          },
          select: { id: true, name: true, meetingAt: true, course: { select: { name: true } } },
        })
      : [],
  ]);

  const upcomingStudyItems = studyItems.flatMap((item) => {
    if (!item.scheduledStart) return [];
    const occurrence = nextWeeklyOccurrence(item.scheduledStart, now);
    return occurrence <= studySessionEnd ? [{ item, occurrence }] : [];
  });

  const notifications = [
    ...tasks.flatMap((task) => task.dueAt ? [{
      userId,
      semesterId,
      title: "Task deadline approaching",
      message: `${task.course?.name ? `${task.course.name}: ` : ""}${task.title} is due soon.`,
      type: "DEADLINE" as const,
      actionUrl: "/tasks",
      sourceKey: `task-deadline:${task.id}:${task.dueAt.toISOString()}`,
    }] : []),
    ...upcomingStudyItems.map(({ item, occurrence }) => ({
      userId,
      semesterId,
      title: "Study session starting soon",
      message: `${item.course?.name ? `${item.course.name}: ` : ""}${item.title.split("||")[0]?.trim() ?? "Study session"} starts in ${Math.max(1, Math.ceil((occurrence.getTime() - now.getTime()) / 60_000))} minutes.`,
      type: "STUDY_PLAN" as const,
      actionUrl: plannerUrl(item.studyPlan.id, occurrence),
      sourceKey: `study-session-close:${item.id}:${occurrence.toISOString()}`,
    })),
    ...goals.flatMap((goal) => goal.deadline ? [{
      userId,
      semesterId,
      title: "Goal deadline approaching",
      message: `${goal.title} is due soon.`,
      type: "DEADLINE" as const,
      actionUrl: "/goals",
      sourceKey: `goal-deadline:${goal.id}:${goal.deadline.toISOString()}`,
    }] : []),
    ...groups.flatMap((group) => group.meetingAt ? [{
      userId,
      semesterId,
      title: "Study group meeting approaching",
      message: `${group.course.name}: ${group.name} meets soon.`,
      type: "GROUP" as const,
      actionUrl: "/peers?view=groups",
      sourceKey: `group-meeting:${group.id}:${group.meetingAt.toISOString()}`,
    }] : []),
  ];

  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications, skipDuplicates: true });
  }

  await prisma.notificationPreference.update({
    where: { userId },
    data: { lastSyncedAt: now },
  });
}
