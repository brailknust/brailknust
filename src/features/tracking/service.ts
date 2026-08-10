import "server-only";
import { prisma } from "@/server/db";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";

function mondayDay(date: Date) { return (date.getUTCDay() + 6) % 7; }
function occurrence(today: Date, time: Date) { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), time.getUTCHours(), time.getUTCMinutes())); return date; }
function notification(userId: string, semesterId: string, title: string, message: string, sourceKey: string, scheduledFor: Date, options?: { expiresAt?: Date; type?: "STUDY_PLAN" | "ATTENDANCE"; actionUrl?: string }) {
  return {
    userId,
    semesterId,
    title,
    message,
    type: options?.type ?? ("STUDY_PLAN" as const),
    actionUrl: options?.actionUrl ?? "/planner",
    sourceKey,
    scheduledFor,
    expiresAt: options?.expiresAt ?? null,
    deliveredAt: new Date(),
    status: "DELIVERED" as const,
    channel: "IN_APP" as const,
  };
}

// The pinned, per-enrollment AiConversation is normally lazily created by the
// ai-chat page (see features/ai/queries.ts). Attendance notices link straight
// into that course's chat so "what did I learn" is captured as a real chat
// message instead of a separate notes field, so we resolve (or create) it
// here too in case the student hasn't opened AI chat for this course yet.
async function getOrCreateCourseConversationId(userId: string, semesterId: string, courseId: string | null) {
  if (!courseId) return null;
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, semesterId, courseId },
    select: { id: true, course: { select: { name: true } } },
  });
  if (!enrollment) return null;

  const existing = await prisma.aiConversation.findFirst({
    where: { userId, semesterId, enrollmentId: enrollment.id, isPinned: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.aiConversation.create({
    data: {
      userId,
      semesterId,
      enrollmentId: enrollment.id,
      title: enrollment.course.name,
      isPinned: true,
    },
    select: { id: true },
  });
  return created.id;
}

export async function reconcileAcademicTracking(userId: string, semesterId: string) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const blocks = await prisma.timetableBlock.findMany({ where: { userId, semesterId, dayOfWeek: mondayDay(now), courseId: { not: null } }, include: { course: true } });
  const notices = [];
  for (const block of blocks) {
    const start = occurrence(now, block.startTime); const end = occurrence(now, block.endTime);
    if (end <= now) {
      const record = await prisma.attendanceRecord.upsert({ where: { userId_timetableBlockId_classDate: { userId, timetableBlockId: block.id, classDate: today } }, create: { userId, semesterId, courseId: block.courseId, timetableBlockId: block.id, classDate: today, scheduledStart: start, scheduledEnd: end }, update: {} });
      if (record.status === "UNCONFIRMED") {
        const conversationId = await getOrCreateCourseConversationId(userId, semesterId, block.courseId);
        notices.push(notification(
          userId,
          semesterId,
          "Attendance check",
          `${block.course?.name ?? "Your class"} ended. Did you attend?`,
          `attendance:${block.id}:${today.toISOString().slice(0, 10)}`,
          now,
          {
            expiresAt: new Date(now.getTime() + 48 * 3600_000),
            type: "ATTENDANCE",
            actionUrl: conversationId ? `/ai-chat?conversation=${conversationId}` : "/academics",
          },
        ));
      }
    }
  }
  const active = await prisma.studySession.findMany({ where: { userId, semesterId, status: "ACTIVE", plannedEnd: { lte: now } } });
  for (const session of active) { const endedAt = session.plannedEnd ?? now; const duration = Math.max(0, Math.floor((endedAt.getTime() - (session.startedAt ?? endedAt).getTime()) / 60_000)); await prisma.studySession.update({ where: { id: session.id }, data: { endedAt, durationMinutes: duration, status: duration ? "COMPLETED" : "EXPIRED", completionSource: "AUTO_CLOSED" } }); notices.push(notification(userId, semesterId, "Study session closed", "Your study timer was closed at its planned end time.", `study-session:end:${session.id}`, now)); }
  if (notices.length) await prisma.notification.createMany({ data: notices, skipDuplicates: true });
  await syncGoalProgressSnapshots(userId, semesterId);
}

export async function getActiveStudySession(userId: string) {
  return prisma.studySession.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      startedAt: true,
      course: { select: { name: true } },
      studyPlanItem: { select: { title: true } },
    },
  });
}

export async function getUpcomingStudyPlanItems(userId: string, semesterId: string, limit = 5) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  return prisma.studyPlanItem.findMany({
    where: {
      status: { not: "ARCHIVED" },
      scheduledStart: { gte: startOfToday, lte: endOfToday },
      studyPlan: { userId, semesterId, status: { not: "ARCHIVED" } },
      studySessions: { none: { status: { in: ["ACTIVE", "COMPLETED"] } } },
    },
    select: {
      id: true,
      title: true,
      scheduledStart: true,
      durationMinutes: true,
      course: { select: { name: true } },
    },
    orderBy: { scheduledStart: "asc" },
    take: limit,
  });
}
