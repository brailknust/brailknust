import "server-only";
import { prisma } from "@/server/db";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";

function mondayDay(date: Date) { return (date.getUTCDay() + 6) % 7; }
function occurrence(today: Date, time: Date) { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), time.getUTCHours(), time.getUTCMinutes())); return date; }
function notification(userId: string, semesterId: string, title: string, message: string, sourceKey: string, scheduledFor: Date, expiresAt?: Date) { return { userId, semesterId, title, message, type: "STUDY_PLAN" as const, actionUrl: "/planner", sourceKey, scheduledFor, expiresAt: expiresAt ?? null, deliveredAt: new Date(), status: "DELIVERED" as const, channel: "IN_APP" as const }; }

export async function reconcileAcademicTracking(userId: string, semesterId: string) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const blocks = await prisma.timetableBlock.findMany({ where: { userId, semesterId, dayOfWeek: mondayDay(now), courseId: { not: null } }, include: { course: true } });
  const notices = [];
  for (const block of blocks) {
    const start = occurrence(now, block.startTime); const end = occurrence(now, block.endTime);
    if (end <= now) {
      const record = await prisma.attendanceRecord.upsert({ where: { userId_timetableBlockId_classDate: { userId, timetableBlockId: block.id, classDate: today } }, create: { userId, semesterId, courseId: block.courseId, timetableBlockId: block.id, classDate: today, scheduledStart: start, scheduledEnd: end }, update: {} });
      if (record.status === "UNCONFIRMED") notices.push(notification(userId, semesterId, "Attendance check", `${block.course?.name ?? "Your class"} ended. Did you attend?`, `attendance:${block.id}:${today.toISOString().slice(0,10)}`, now, new Date(now.getTime() + 48 * 3600_000)));
    }
  }
  const active = await prisma.studySession.findMany({ where: { userId, semesterId, status: "ACTIVE", plannedEnd: { lte: now } } });
  for (const session of active) { const endedAt = session.plannedEnd ?? now; const duration = Math.max(0, Math.floor((endedAt.getTime() - (session.startedAt ?? endedAt).getTime()) / 60_000)); await prisma.studySession.update({ where: { id: session.id }, data: { endedAt, durationMinutes: duration, status: duration ? "COMPLETED" : "EXPIRED", completionSource: "AUTO_CLOSED" } }); notices.push(notification(userId, semesterId, "Study session closed", "Your study timer was closed at its planned end time.", `study-session:end:${session.id}`, now)); }
  if (notices.length) await prisma.notification.createMany({ data: notices, skipDuplicates: true });
  await syncGoalProgressSnapshots(userId, semesterId);
}
