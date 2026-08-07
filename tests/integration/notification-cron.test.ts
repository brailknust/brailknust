import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  users: vi.fn(),
  cleanup: vi.fn(),
  sync: vi.fn(),
  goals: vi.fn(),
  tracking: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: { user: { findMany: mocks.users }, notification: { deleteMany: mocks.cleanup } } }));
vi.mock("@/features/notifications/service", () => ({ syncNotificationsForUser: mocks.sync }));
vi.mock("@/features/goals/progress-sync", () => ({ syncGoalProgressSnapshots: mocks.goals }));
vi.mock("@/features/tracking/service", () => ({ reconcileAcademicTracking: mocks.tracking }));

import { runNotificationCronBatch } from "@/features/notifications/cron";

describe("notification scheduler batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.mockResolvedValue([
      { id: "user-1", activeSemesterId: "semester-1" },
      { id: "user-2", activeSemesterId: "semester-2" },
    ]);
    mocks.cleanup.mockResolvedValue({ count: 3 });
    mocks.sync.mockResolvedValue(undefined);
    mocks.goals.mockResolvedValue(undefined);
    mocks.tracking.mockResolvedValue(undefined);
  });

  it("processes active users and reports terminal-record cleanup", async () => {
    const result = await runNotificationCronBatch();
    expect(result).toEqual(expect.objectContaining({ processed: 2, synced: 2, failed: 0, retainedCleanupDeleted: 3, nextCursor: null }));
    expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({ where: { activeSemesterId: { not: null }, deletedAt: null }, take: 100 }));
    expect(mocks.cleanup).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: ["READ", "DISMISSED", "EXPIRED"] } }) }));
  });

  it("isolates a failed user while continuing the batch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.sync.mockRejectedValueOnce(new Error("temporary failure"));
    const result = await runNotificationCronBatch("previous-user");
    expect(result).toEqual(expect.objectContaining({ processed: 2, synced: 1, failed: 1 }));
    expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "previous-user" }, skip: 1 }));
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });
});
