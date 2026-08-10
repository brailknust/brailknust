import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  requireActiveWritableSemester: vi.fn(),
  revalidatePath: vi.fn(),
  syncNotificationsForUser: vi.fn(),
  syncGoalProgressSnapshots: vi.fn(),
  attendanceFindFirst: vi.fn(),
  attendanceUpdate: vi.fn(),
  studyPlanItemFindFirst: vi.fn(),
  studySessionCreate: vi.fn(),
  studySessionFindFirst: vi.fn(),
  studySessionUpdate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    attendanceRecord: { findFirst: mocks.attendanceFindFirst, update: mocks.attendanceUpdate },
    studyPlanItem: { findFirst: mocks.studyPlanItemFindFirst },
    studySession: { create: mocks.studySessionCreate, findFirst: mocks.studySessionFindFirst, update: mocks.studySessionUpdate },
  },
}));
vi.mock("@/features/auth/queries", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/features/academics/semester-state", () => ({ requireActiveWritableSemester: mocks.requireActiveWritableSemester }));
vi.mock("@/features/goals/progress-sync", () => ({ syncGoalProgressSnapshots: mocks.syncGoalProgressSnapshots }));
vi.mock("@/features/notifications/service", () => ({ syncNotificationsForUser: mocks.syncNotificationsForUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { respondToAttendance, startStudyTimer, stopStudyTimer } from "@/features/tracking/actions";

const userId = "user-1";
const semesterId = "semester-1";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("respondToAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId, activeSemesterId: semesterId } });
    mocks.syncNotificationsForUser.mockResolvedValue(undefined);
  });

  it.each(["ATTENDED", "MISSED", "CANCELLED", "EXCUSED"])("accepts %s as a valid response", async (status) => {
    mocks.attendanceFindFirst.mockResolvedValue({ id: "record-1" });
    mocks.attendanceUpdate.mockResolvedValue({});

    await respondToAttendance(form({ attendanceId: "record-1", status }));

    expect(mocks.attendanceUpdate).toHaveBeenCalledWith({
      where: { id: "record-1" },
      data: expect.objectContaining({ status, source: "SELF_REPORTED" }),
    });
  });

  it("rejects an invalid status without touching the database", async () => {
    await expect(respondToAttendance(form({ attendanceId: "record-1", status: "MAYBE" })))
      .rejects.toThrow("Choose a valid attendance response.");
    expect(mocks.attendanceFindFirst).not.toHaveBeenCalled();
  });

  it("refuses to update a record that does not belong to the signed-in user", async () => {
    mocks.attendanceFindFirst.mockResolvedValue(null);
    await expect(respondToAttendance(form({ attendanceId: "someone-elses-record", status: "ATTENDED" })))
      .rejects.toThrow("Attendance record not found.");
    expect(mocks.attendanceFindFirst).toHaveBeenCalledWith({ where: { id: "someone-elses-record", userId } });
    expect(mocks.attendanceUpdate).not.toHaveBeenCalled();
  });

  it("triggers an immediate notification sync and revalidates the notifications page", async () => {
    mocks.attendanceFindFirst.mockResolvedValue({ id: "record-1" });
    mocks.attendanceUpdate.mockResolvedValue({});

    await respondToAttendance(form({ attendanceId: "record-1", status: "ATTENDED" }));

    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(userId, true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/notifications");
  });
});

describe("startStudyTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T09:00:00.000Z"));
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId, activeSemesterId: semesterId } });
    mocks.requireActiveWritableSemester.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("rejects when the student has no active semester", async () => {
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId, activeSemesterId: null } });
    await expect(startStudyTimer(form({ studyPlanItemId: "item-1" }))).rejects.toThrow("Set an active semester first.");
    expect(mocks.studyPlanItemFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a study plan item that isn't the student's own", async () => {
    mocks.studyPlanItemFindFirst.mockResolvedValue(null);
    await expect(startStudyTimer(form({ studyPlanItemId: "foreign-item" }))).rejects.toThrow("Study session not found.");
    expect(mocks.studyPlanItemFindFirst).toHaveBeenCalledWith({
      where: { id: "foreign-item", studyPlan: { userId, semesterId } },
    });
  });

  it("computes plannedEnd from the item's scheduled start and duration", async () => {
    mocks.studyPlanItemFindFirst.mockResolvedValue({
      id: "item-1",
      courseId: "course-1",
      scheduledStart: new Date("2026-08-05T09:00:00.000Z"),
      durationMinutes: 45,
    });
    mocks.studySessionCreate.mockResolvedValue({});

    await startStudyTimer(form({ studyPlanItemId: "item-1" }));

    expect(mocks.studySessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "ACTIVE",
        studyPlanItemId: "item-1",
        plannedStart: new Date("2026-08-05T09:00:00.000Z"),
        plannedEnd: new Date("2026-08-05T09:45:00.000Z"),
        startedAt: new Date("2026-08-05T09:00:00.000Z"),
      }),
    });
  });

  it("leaves plannedEnd null for an item with no scheduled start or duration", async () => {
    mocks.studyPlanItemFindFirst.mockResolvedValue({
      id: "item-2",
      courseId: null,
      scheduledStart: null,
      durationMinutes: null,
    });
    mocks.studySessionCreate.mockResolvedValue({});

    await startStudyTimer(form({ studyPlanItemId: "item-2" }));

    expect(mocks.studySessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ plannedEnd: null }),
    });
  });
});

describe("stopStudyTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId, activeSemesterId: semesterId } });
    mocks.syncGoalProgressSnapshots.mockResolvedValue(undefined);
    mocks.syncNotificationsForUser.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("rejects when there is no active session to stop", async () => {
    mocks.studySessionFindFirst.mockResolvedValue(null);
    await expect(stopStudyTimer(form({ studySessionId: "session-1" }))).rejects.toThrow("Active study timer not found.");
    expect(mocks.studySessionUpdate).not.toHaveBeenCalled();
  });

  it("floors the elapsed duration to whole minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T09:32:30.000Z"));
    mocks.studySessionFindFirst.mockResolvedValue({
      id: "session-1",
      userId,
      semesterId,
      status: "ACTIVE",
      startedAt: new Date("2026-08-05T09:00:00.000Z"),
    });

    await stopStudyTimer(form({ studySessionId: "session-1" }));

    expect(mocks.studySessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ durationMinutes: 32, status: "COMPLETED", completionSource: "TIMER_TRACKED" }),
    });
  });

  it("clamps a sub-minute session to a minimum of 1 minute instead of 0", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T09:00:20.000Z"));
    mocks.studySessionFindFirst.mockResolvedValue({
      id: "session-1",
      userId,
      semesterId,
      status: "ACTIVE",
      startedAt: new Date("2026-08-05T09:00:00.000Z"),
    });

    await stopStudyTimer(form({ studySessionId: "session-1" }));

    expect(mocks.studySessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ durationMinutes: 1 }),
    });
  });

  it("syncs goal progress and notifications for the session's own semester", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T10:00:00.000Z"));
    mocks.studySessionFindFirst.mockResolvedValue({
      id: "session-1",
      userId,
      semesterId: "a-different-semester",
      status: "ACTIVE",
      startedAt: new Date("2026-08-05T09:00:00.000Z"),
    });

    await stopStudyTimer(form({ studySessionId: "session-1" }));

    expect(mocks.syncGoalProgressSnapshots).toHaveBeenCalledWith(userId, "a-different-semester");
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(userId, true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/notifications");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/planner");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/goals");
  });
});
