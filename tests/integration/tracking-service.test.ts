import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blocks: vi.fn(),
  attendanceUpsert: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  activeSessions: vi.fn(),
  sessionUpdate: vi.fn(),
  createNotifications: vi.fn(),
  syncGoals: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    timetableBlock: { findMany: mocks.blocks },
    attendanceRecord: { upsert: mocks.attendanceUpsert },
    enrollment: { findFirst: mocks.enrollmentFindFirst },
    aiConversation: { findFirst: mocks.conversationFindFirst, create: mocks.conversationCreate },
    studySession: { findMany: mocks.activeSessions, update: mocks.sessionUpdate },
    notification: { createMany: mocks.createNotifications },
  },
}));
vi.mock("@/features/goals/progress-sync", () => ({ syncGoalProgressSnapshots: mocks.syncGoals }));

import { reconcileAcademicTracking } from "@/features/tracking/service";

// 2026-08-05 is a Wednesday (mondayDay = 2); the block below is scheduled
// for that same weekday so reconcileAcademicTracking's "today" filter matches.
const now = new Date("2026-08-05T14:00:00.000Z");
const userId = "user-1";
const semesterId = "semester-1";
const timetableBlockId = "block-1";
const courseId = "course-1";

function block(overrides: Partial<{ startHour: number; endHour: number }> = {}) {
  const { startHour = 9, endHour = 10 } = overrides;
  return {
    id: timetableBlockId,
    courseId,
    course: { name: "Data Structures" },
    startTime: new Date(Date.UTC(1970, 0, 1, startHour, 0)),
    endTime: new Date(Date.UTC(1970, 0, 1, endHour, 0)),
  };
}

describe("reconcileAcademicTracking — attendance notices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    mocks.activeSessions.mockResolvedValue([]);
    mocks.createNotifications.mockResolvedValue({ count: 0 });
    mocks.syncGoals.mockResolvedValue(undefined);
  });

  it("does nothing for a class that has not ended yet", async () => {
    mocks.blocks.mockResolvedValue([block({ startHour: 13, endHour: 15 })]); // ends 15:00, now is 14:00
    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.attendanceUpsert).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("creates an UNCONFIRMED attendance record and an ATTENDANCE notice once class has ended", async () => {
    mocks.blocks.mockResolvedValue([block()]); // ends 10:00, now is 14:00
    mocks.attendanceUpsert.mockResolvedValue({ status: "UNCONFIRMED" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1", course: { name: "Data Structures" } });
    mocks.conversationFindFirst.mockResolvedValue({ id: "conversation-1" });

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.attendanceUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_timetableBlockId_classDate: expect.objectContaining({ userId, timetableBlockId }) },
    }));
    const call = mocks.createNotifications.mock.calls[0][0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0]).toMatchObject({
      type: "ATTENDANCE",
      actionUrl: "/ai-chat?conversation=conversation-1",
      sourceKey: expect.stringMatching(/^attendance:block-1:2026-08-05$/),
    });
  });

  it("reuses an existing pinned AI conversation instead of creating a duplicate", async () => {
    mocks.blocks.mockResolvedValue([block()]);
    mocks.attendanceUpsert.mockResolvedValue({ status: "UNCONFIRMED" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1", course: { name: "Data Structures" } });
    mocks.conversationFindFirst.mockResolvedValue({ id: "existing-conversation" });

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.conversationCreate).not.toHaveBeenCalled();
    expect(mocks.createNotifications.mock.calls[0][0].data[0].actionUrl).toBe("/ai-chat?conversation=existing-conversation");
  });

  it("creates the pinned AI conversation on demand when the student has never opened AI chat for the course", async () => {
    mocks.blocks.mockResolvedValue([block()]);
    mocks.attendanceUpsert.mockResolvedValue({ status: "UNCONFIRMED" });
    mocks.enrollmentFindFirst.mockResolvedValue({ id: "enrollment-1", course: { name: "Data Structures" } });
    mocks.conversationFindFirst.mockResolvedValue(null);
    mocks.conversationCreate.mockResolvedValue({ id: "new-conversation" });

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.conversationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ enrollmentId: "enrollment-1", isPinned: true }),
    }));
    expect(mocks.createNotifications.mock.calls[0][0].data[0].actionUrl).toBe("/ai-chat?conversation=new-conversation");
  });

  it("falls back to /academics when no enrollment can be resolved for the course", async () => {
    mocks.blocks.mockResolvedValue([block()]);
    mocks.attendanceUpsert.mockResolvedValue({ status: "UNCONFIRMED" });
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.conversationFindFirst).not.toHaveBeenCalled();
    expect(mocks.createNotifications.mock.calls[0][0].data[0].actionUrl).toBe("/academics");
  });

  it("does not re-notify once the student has already responded to attendance", async () => {
    mocks.blocks.mockResolvedValue([block()]);
    mocks.attendanceUpsert.mockResolvedValue({ status: "ATTENDED" });

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.enrollmentFindFirst).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("handles several classes ending in the same reconcile pass independently", async () => {
    mocks.blocks.mockResolvedValue([
      { ...block({ startHour: 8, endHour: 9 }), id: "block-early", course: { name: "Algebra" } },
      { ...block({ startHour: 9, endHour: 10 }), id: "block-1", course: { name: "Data Structures" } },
      { ...block({ startHour: 13, endHour: 15 }), id: "block-later", course: { name: "Networks" } }, // not yet ended
    ]);
    mocks.attendanceUpsert.mockImplementation(({ where }: { where: { userId_timetableBlockId_classDate: { timetableBlockId: string } } }) =>
      Promise.resolve({ status: where.userId_timetableBlockId_classDate.timetableBlockId === "block-early" ? "ATTENDED" : "UNCONFIRMED" }));
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    await reconcileAcademicTracking(userId, semesterId);

    // block-later hasn't ended: no upsert at all for it.
    expect(mocks.attendanceUpsert).toHaveBeenCalledTimes(2);
    // block-early already responded, block-1 is a fresh UNCONFIRMED notice.
    expect(mocks.createNotifications.mock.calls[0][0].data).toHaveLength(1);
  });
});

describe("reconcileAcademicTracking — study session auto-close", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    mocks.blocks.mockResolvedValue([]);
    mocks.createNotifications.mockResolvedValue({ count: 0 });
    mocks.syncGoals.mockResolvedValue(undefined);
  });

  it("closes an overdue active session as COMPLETED and notifies once", async () => {
    mocks.activeSessions.mockResolvedValue([{
      id: "session-1",
      startedAt: new Date("2026-08-05T12:00:00.000Z"),
      plannedEnd: new Date("2026-08-05T13:00:00.000Z"),
    }]);

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ status: "COMPLETED", durationMinutes: 60, completionSource: "AUTO_CLOSED" }),
    });
    expect(mocks.createNotifications.mock.calls[0][0].data[0]).toMatchObject({
      type: "STUDY_PLAN",
      sourceKey: "study-session:end:session-1",
    });
  });

  it("marks a zero-duration session as EXPIRED instead of COMPLETED", async () => {
    mocks.activeSessions.mockResolvedValue([{
      id: "session-2",
      startedAt: new Date("2026-08-05T13:00:00.000Z"),
      plannedEnd: new Date("2026-08-05T13:00:00.000Z"),
    }]);

    await reconcileAcademicTracking(userId, semesterId);

    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-2" },
      data: expect.objectContaining({ status: "EXPIRED", durationMinutes: 0 }),
    });
  });

  it("always syncs goal progress even when there is nothing to reconcile", async () => {
    mocks.activeSessions.mockResolvedValue([]);
    await reconcileAcademicTracking(userId, semesterId);
    expect(mocks.syncGoals).toHaveBeenCalledWith(userId, semesterId);
  });
});
