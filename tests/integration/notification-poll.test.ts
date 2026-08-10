import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  getAppUserByAuthId: vi.fn(),
  checkRateLimit: vi.fn(),
  syncNotificationsForUser: vi.fn(),
  isNotificationSyncStale: vi.fn(),
  reconcileAcademicTracking: vi.fn(),
  getActiveStudySession: vi.fn(),
  prisma: {
    notificationPreference: { findUnique: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/features/auth/queries", () => ({
  getSupabaseUser: mocks.getSupabaseUser,
  getAppUserByAuthId: mocks.getAppUserByAuthId,
}));
vi.mock("@/features/notifications/service", () => ({
  syncNotificationsForUser: mocks.syncNotificationsForUser,
  isNotificationSyncStale: mocks.isNotificationSyncStale,
}));
vi.mock("@/features/tracking/service", () => ({
  reconcileAcademicTracking: mocks.reconcileAcademicTracking,
  getActiveStudySession: mocks.getActiveStudySession,
}));
vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(() => Response.json({ error: "Too many requests" }, { status: 429 })),
}));

import { GET } from "@/app/api/notifications/poll/route";

const appUser = { id: "user-1", activeSemesterId: "semester-1" };

describe("GET /api/notifications/poll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
    vi.clearAllMocks();
    mocks.getSupabaseUser.mockResolvedValue({ id: "auth-user" });
    mocks.getAppUserByAuthId.mockResolvedValue(appUser);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.prisma.notification.findMany.mockResolvedValue([]);
    mocks.prisma.notification.count.mockResolvedValue(0);
    mocks.getActiveStudySession.mockResolvedValue(null);
  });

  afterEach(() => vi.useRealTimers());

  it("regenerates reminders when the last sync is stale", async () => {
    mocks.isNotificationSyncStale.mockResolvedValue(true);

    await GET();

    expect(mocks.reconcileAcademicTracking).toHaveBeenCalledWith(appUser.id, appUser.activeSemesterId);
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(appUser.id);
  });

  it("regenerates reminders when no preference row exists yet", async () => {
    mocks.isNotificationSyncStale.mockResolvedValue(true);

    await GET();

    expect(mocks.reconcileAcademicTracking).toHaveBeenCalledWith(appUser.id, appUser.activeSemesterId);
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(appUser.id);
  });

  it("skips regeneration when the last sync is within the throttle window", async () => {
    mocks.isNotificationSyncStale.mockResolvedValue(false);

    await GET();

    expect(mocks.reconcileAcademicTracking).not.toHaveBeenCalled();
    expect(mocks.syncNotificationsForUser).not.toHaveBeenCalled();
    expect(mocks.prisma.notification.findMany).toHaveBeenCalled();
  });

  it("does not reconcile attendance for a user with no active semester", async () => {
    mocks.getAppUserByAuthId.mockResolvedValue({ id: "user-2", activeSemesterId: null });
    mocks.isNotificationSyncStale.mockResolvedValue(true);

    await GET();

    expect(mocks.reconcileAcademicTracking).not.toHaveBeenCalled();
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith("user-2");
  });

  it("returns 401 for an unauthenticated request", async () => {
    mocks.getSupabaseUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.syncNotificationsForUser).not.toHaveBeenCalled();
  });
});
