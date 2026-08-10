import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preferenceFind: vi.fn(),
  notificationFindMany: vi.fn(),
  notificationCount: vi.fn(),
  attendanceFindMany: vi.fn(),
  getActiveStudySession: vi.fn(),
  getUpcomingStudyPlanItems: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    notificationPreference: { findUnique: mocks.preferenceFind },
    notification: { findMany: mocks.notificationFindMany, count: mocks.notificationCount },
    attendanceRecord: { findMany: mocks.attendanceFindMany },
  },
}));
vi.mock("@/features/tracking/service", () => ({
  getActiveStudySession: mocks.getActiveStudySession,
  getUpcomingStudyPlanItems: mocks.getUpcomingStudyPlanItems,
}));

import { getNotificationCenterData, getStudySessionPanelData } from "@/features/notifications/queries";

const userId = "user-1";

function notification(overrides: Partial<{ id: string; type: string; sourceKey: string | null }> = {}) {
  return {
    id: "notification-1",
    type: "DEADLINE",
    sourceKey: null,
    title: "Task deadline approaching",
    message: "Submit lab is due soon.",
    createdAt: new Date("2026-08-05T09:00:00.000Z"),
    isRead: false,
    actionUrl: "/tasks",
    ...overrides,
  };
}

describe("getNotificationCenterData — attendance record linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preferenceFind.mockResolvedValue({ userId });
    mocks.notificationCount.mockResolvedValue(0);
  });

  it("skips the attendance lookup entirely when there are no ATTENDANCE notifications", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      notification({ id: "n1", type: "DEADLINE" }),
      notification({ id: "n2", type: "GROUP" }),
    ]);

    const data = await getNotificationCenterData(userId);

    expect(mocks.attendanceFindMany).not.toHaveBeenCalled();
    expect(data.notifications).toEqual([
      expect.objectContaining({ id: "n1", attendanceRecordId: null, attendanceStatus: null }),
      expect.objectContaining({ id: "n2", attendanceRecordId: null, attendanceStatus: null }),
    ]);
  });

  it("resolves the matching attendance record id and status by (timetableBlockId, classDate)", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      notification({ id: "n1", type: "ATTENDANCE", sourceKey: "attendance:block-1:2026-08-05" }),
    ]);
    mocks.attendanceFindMany.mockResolvedValue([
      { id: "record-1", timetableBlockId: "block-1", classDate: new Date("2026-08-05T00:00:00.000Z"), status: "UNCONFIRMED" },
    ]);

    const data = await getNotificationCenterData(userId);

    expect(mocks.attendanceFindMany).toHaveBeenCalledWith({
      where: { userId, OR: [{ timetableBlockId: "block-1", classDate: new Date("2026-08-05") }] },
      select: { id: true, timetableBlockId: true, classDate: true, status: true },
    });
    expect(data.notifications[0]).toMatchObject({ attendanceRecordId: "record-1", attendanceStatus: "UNCONFIRMED" });
  });

  it("disambiguates two ATTENDANCE notices for the same class on different dates", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      notification({ id: "n1", type: "ATTENDANCE", sourceKey: "attendance:block-1:2026-08-04" }),
      notification({ id: "n2", type: "ATTENDANCE", sourceKey: "attendance:block-1:2026-08-05" }),
    ]);
    mocks.attendanceFindMany.mockResolvedValue([
      { id: "record-old", timetableBlockId: "block-1", classDate: new Date("2026-08-04T00:00:00.000Z"), status: "ATTENDED" },
      { id: "record-new", timetableBlockId: "block-1", classDate: new Date("2026-08-05T00:00:00.000Z"), status: "UNCONFIRMED" },
    ]);

    const data = await getNotificationCenterData(userId);
    const byId = new Map(data.notifications.map((item) => [item.id, item]));

    expect(byId.get("n1")).toMatchObject({ attendanceRecordId: "record-old", attendanceStatus: "ATTENDED" });
    expect(byId.get("n2")).toMatchObject({ attendanceRecordId: "record-new", attendanceStatus: "UNCONFIRMED" });
  });

  it("leaves attendanceRecordId null (without crashing) when the underlying record was removed", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      notification({ id: "n1", type: "ATTENDANCE", sourceKey: "attendance:block-gone:2026-08-05" }),
    ]);
    mocks.attendanceFindMany.mockResolvedValue([]);

    const data = await getNotificationCenterData(userId);

    expect(data.notifications[0]).toMatchObject({ attendanceRecordId: null, attendanceStatus: null });
  });

  it.each(["active", "unread", "missed", "history"])("builds a status filter for the %s view", async (view) => {
    mocks.notificationFindMany.mockResolvedValue([]);
    await getNotificationCenterData(userId, view);
    expect(mocks.notificationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId }),
    }));
  });
});

describe("getStudySessionPanelData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty panel without querying when there is no active semester", async () => {
    const data = await getStudySessionPanelData(userId, null);
    expect(data).toEqual({ active: null, upcoming: [] });
    expect(mocks.getActiveStudySession).not.toHaveBeenCalled();
    expect(mocks.getUpcomingStudyPlanItems).not.toHaveBeenCalled();
  });

  it("delegates to the tracking service for the active semester", async () => {
    mocks.getActiveStudySession.mockResolvedValue({ id: "session-1" });
    mocks.getUpcomingStudyPlanItems.mockResolvedValue([{ id: "item-1" }]);

    const data = await getStudySessionPanelData(userId, "semester-1");

    expect(mocks.getActiveStudySession).toHaveBeenCalledWith(userId);
    expect(mocks.getUpcomingStudyPlanItems).toHaveBeenCalledWith(userId, "semester-1");
    expect(data).toEqual({ active: { id: "session-1" }, upcoming: [{ id: "item-1" }] });
  });
});
