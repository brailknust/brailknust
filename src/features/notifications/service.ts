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
  const now = new Date();
  // A delivered reminder is active only until its expiry. It remains in history afterwards.
  await prisma.notification.updateMany({
    where: { userId, status: { in: ["PENDING", "DELIVERED"] }, expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const existingPreference = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (
    !force &&
    existingPreference?.lastSyncedAt &&
    now.getTime() - existingPreference.lastSyncedAt.getTime() < syncThrottleMs
  ) {
    return;
  }

  const preference =
    existingPreference ??
    (await prisma.notificationPreference.create({
      data: { userId },
    }));

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
            status: "TODO",
            OR: [
              {
                reminderAt: { lte: now },
                OR: [{ dueAt: null }, { dueAt: { gte: now } }],
              },
              {
                reminderAt: null,
                dueAt: { gte: now, lte: deadlineEnd },
              },
            ],
          },
          select: { id: true, title: true, dueAt: true, reminderAt: true, course: { select: { name: true } } },
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
    ...tasks.map((task) => ({
      userId,
      semesterId,
      title: task.reminderAt ? "Task reminder" : "Task deadline approaching",
      message: `${task.course?.name ? `${task.course.name}: ` : ""}${task.title}${task.dueAt ? " is due soon." : "."}`,
      type: "DEADLINE" as const,
      actionUrl: "/tasks",
      sourceKey: task.reminderAt
        ? `task-reminder:${task.id}:${task.reminderAt.toISOString()}`
        : `task-deadline:${task.id}:${task.dueAt!.toISOString()}`,
      scheduledFor: task.reminderAt ?? task.dueAt,
      expiresAt: task.dueAt ?? deadlineEnd,
      deliveredAt: now,
      status: "DELIVERED" as const,
      channel: "IN_APP" as const,
    })),
    ...upcomingStudyItems.map(({ item, occurrence }) => ({
      userId,
      semesterId,
      title: "Study session starting soon",
      message: `${item.course?.name ? `${item.course.name}: ` : ""}${item.title.split("||")[0]?.trim() ?? "Study session"} starts in ${Math.max(1, Math.ceil((occurrence.getTime() - now.getTime()) / 60_000))} minutes.`,
      type: "STUDY_PLAN" as const,
      actionUrl: plannerUrl(item.studyPlan.id, occurrence),
      sourceKey: `study-session-close:${item.id}:${occurrence.toISOString()}`,
      scheduledFor: occurrence,
      expiresAt: new Date(occurrence.getTime() + 60 * 60 * 1000),
      deliveredAt: now,
      status: "DELIVERED" as const,
      channel: "IN_APP" as const,
    })),
    ...goals.flatMap((goal) => goal.deadline ? [{
      userId,
      semesterId,
      title: "Goal deadline approaching",
      message: `${goal.title} is due soon.`,
      type: "DEADLINE" as const,
      actionUrl: "/goals",
      sourceKey: `goal-deadline:${goal.id}:${goal.deadline.toISOString()}`,
      scheduledFor: goal.deadline,
      expiresAt: goal.deadline,
      deliveredAt: now,
      status: "DELIVERED" as const,
      channel: "IN_APP" as const,
    }] : []),
    ...groups.flatMap((group) => group.meetingAt ? [{
      userId,
      semesterId,
      title: "Study group meeting approaching",
      message: `${group.course.name}: ${group.name} meets soon.`,
      type: "GROUP" as const,
      actionUrl: "/peers?view=groups",
      sourceKey: `group-meeting:${group.id}:${group.meetingAt.toISOString()}`,
      scheduledFor: group.meetingAt,
      expiresAt: group.meetingAt,
      deliveredAt: now,
      status: "DELIVERED" as const,
      channel: "IN_APP" as const,
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
