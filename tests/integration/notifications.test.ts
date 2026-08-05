import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preferenceFind: vi.fn(),
  preferenceCreate: vi.fn(),
  preferenceUpdate: vi.fn(),
  user: vi.fn(),
  tasks: vi.fn(),
  studyItems: vi.fn(),
  goals: vi.fn(),
  groups: vi.fn(),
  createNotifications: vi.fn(),
  expireNotifications: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    notificationPreference: {
      findUnique: mocks.preferenceFind,
      create: mocks.preferenceCreate,
      update: mocks.preferenceUpdate,
    },
    user: { findUnique: mocks.user },
    task: { findMany: mocks.tasks },
    studyPlanItem: { findMany: mocks.studyItems },
    goal: { findMany: mocks.goals },
    studyGroup: { findMany: mocks.groups },
    notification: { createMany: mocks.createNotifications, updateMany: mocks.expireNotifications },
  },
}));

import { syncNotificationsForUser } from "@/features/notifications/service";

const preference = {
  userId: "user-1",
  taskDeadlines: true,
  studySessions: true,
  groupUpdates: true,
  goalDeadlines: true,
  qaAnswers: true,
  studySessionReminderMinutes: 15,
  reminderHours: 24,
  browserAlerts: false,
  lastSyncedAt: null,
};

describe("notification synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T10:00:00.000Z"));
    vi.clearAllMocks();
    mocks.preferenceFind.mockResolvedValue(preference);
    mocks.preferenceUpdate.mockResolvedValue({});
    mocks.user.mockResolvedValue({
      activeSemesterId: "semester-1",
      activeSemester: { academicYear: "2026/2027", level: "LEVEL_200", term: "FIRST" },
    });
    mocks.tasks.mockResolvedValue([{
      id: "task-1",
      title: "Submit lab",
      dueAt: new Date("2026-08-04T12:00:00.000Z"),
      reminderAt: null,
      course: { name: "Data Structures" },
    }]);
    mocks.studyItems.mockResolvedValue([{
      id: "study-1",
      title: "Queue revision || generated",
      scheduledStart: new Date("2020-08-04T10:10:00.000Z"),
      course: { name: "Data Structures" },
      studyPlan: { id: "plan-1" },
    }]);
    mocks.goals.mockResolvedValue([{
      id: "goal-1",
      title: "Finish revision",
      deadline: new Date("2026-08-05T00:00:00.000Z"),
    }]);
    mocks.groups.mockResolvedValue([{
      id: "group-1",
      name: "Revision group",
      meetingAt: new Date("2026-08-04T18:00:00.000Z"),
      course: { name: "Data Structures" },
    }]);
    mocks.createNotifications.mockResolvedValue({ count: 4 });
    mocks.expireNotifications.mockResolvedValue({ count: 0 });
  });

  afterEach(() => vi.useRealTimers());

  it("creates stable, deduplicated sources for each enabled reminder type", async () => {
    await syncNotificationsForUser("user-1", true);

    const call = mocks.createNotifications.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data.map((item: { sourceKey: string }) => item.sourceKey)).toEqual(expect.arrayContaining([
      "task-deadline:task-1:2026-08-04T12:00:00.000Z",
      "study-session-close:study-1:2026-08-04T10:10:00.000Z",
      "goal-deadline:goal-1:2026-08-05T00:00:00.000Z",
      "group-meeting:group-1:2026-08-04T18:00:00.000Z",
    ]));
    expect(mocks.preferenceUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { lastSyncedAt: new Date("2026-08-04T10:00:00.000Z") },
    });
  });

  it("uses the five-minute throttle unless synchronization is forced", async () => {
    mocks.preferenceFind.mockResolvedValue({
      ...preference,
      lastSyncedAt: new Date("2026-08-04T09:58:00.000Z"),
    });

    await syncNotificationsForUser("user-1");
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });
});
