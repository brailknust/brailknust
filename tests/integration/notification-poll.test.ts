import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  getAppUserByAuthId: vi.fn(),
  checkRateLimit: vi.fn(),
  syncNotificationsForUser: vi.fn(),
  reconcileAcademicTracking: vi.fn(),
  prisma: {
    notificationPreference: { findUnique: vi.fn() },
    notification: { findMany: vi.fn() },
  },
}));

vi.mock("@/features/auth/queries", () => ({
  getSupabaseUser: mocks.getSupabaseUser,
  getAppUserByAuthId: mocks.getAppUserByAuthId,
}));
vi.mock("@/features/notifications/service", () => ({
  syncNotificationsForUser: mocks.syncNotificationsForUser,
}));
vi.mock("@/features/tracking/service", () => ({
  reconcileAcademicTracking: mocks.reconcileAcademicTracking,
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
  });

  afterEach(() => vi.useRealTimers());

  it("regenerates reminders when the last sync is stale", async () => {
    mocks.prisma.notificationPreference.findUnique.mockResolvedValue({
      lastSyncedAt: new Date("2026-08-10T09:58:00.000Z"), // 2 minutes ago, past the 1-minute window
    });

    await GET();

    expect(mocks.reconcileAcademicTracking).toHaveBeenCalledWith(appUser.id, appUser.activeSemesterId);
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(appUser.id);
  });

  it("regenerates reminders when no preference row exists yet", async () => {
    mocks.prisma.notificationPreference.findUnique.mockResolvedValue(null);

    await GET();

    expect(mocks.reconcileAcademicTracking).toHaveBeenCalledWith(appUser.id, appUser.activeSemesterId);
    expect(mocks.syncNotificationsForUser).toHaveBeenCalledWith(appUser.id);
  });

  it("skips regeneration when the last sync is within the throttle window", async () => {
    mocks.prisma.notificationPreference.findUnique.mockResolvedValue({
      lastSyncedAt: new Date("2026-08-10T09:59:30.000Z"), // 30 seconds ago
    });

    await GET();

    expect(mocks.reconcileAcademicTracking).not.toHaveBeenCalled();
    expect(mocks.syncNotificationsForUser).not.toHaveBeenCalled();
    expect(mocks.prisma.notification.findMany).toHaveBeenCalled();
  });

  it("does not reconcile attendance for a user with no active semester", async () => {
    mocks.getAppUserByAuthId.mockResolvedValue({ id: "user-2", activeSemesterId: null });
    mocks.prisma.notificationPreference.findUnique.mockResolvedValue(null);

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
