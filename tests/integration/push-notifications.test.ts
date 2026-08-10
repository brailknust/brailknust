import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    deviceToken: { findMany: vi.fn(), deleteMany: vi.fn() },
    pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
    notification: { findMany: vi.fn(), updateMany: vi.fn() },
  },
  webPushSendNotification: vi.fn(),
  webPushSetVapidDetails: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("web-push", () => ({
  default: {
    sendNotification: mocks.webPushSendNotification,
    setVapidDetails: mocks.webPushSetVapidDetails,
  },
}));

const userId = "user-1";
const notificationRow = { id: "notif-1", title: "Study session starting soon", message: "Data Structures starts in 10 minutes.", actionUrl: "/planner" };

describe("pushPendingNotificationsForUser (Expo/mobile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("no-ops when the user has no registered devices", async () => {
    mocks.prisma.deviceToken.findMany.mockResolvedValue([]);
    const { pushPendingNotificationsForUser } = await import("@/features/notifications/push");

    const result = await pushPendingNotificationsForUser(userId);

    expect(result).toEqual({ sent: 0 });
    expect(mocks.prisma.notification.findMany).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends to every registered device and marks notifications pushed", async () => {
    mocks.prisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[a]" }]);
    mocks.prisma.notification.findMany.mockResolvedValue([notificationRow]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "ok", id: "ticket-1" }] }),
    });

    const { pushPendingNotificationsForUser } = await import("@/features/notifications/push");
    const result = await pushPendingNotificationsForUser(userId);

    expect(result).toEqual({ sent: 1 });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["notif-1"] } },
      data: { pushedAt: expect.any(Date) },
    });
  });

  it("prunes tokens Expo reports as no longer registered", async () => {
    mocks.prisma.deviceToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[stale]" }]);
    mocks.prisma.notification.findMany.mockResolvedValue([notificationRow]);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }] }),
    });

    const { pushPendingNotificationsForUser } = await import("@/features/notifications/push");
    await pushPendingNotificationsForUser(userId);

    expect(mocks.prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ["ExponentPushToken[stale]"] } },
    });
  });
});

describe("pushWebNotificationsForUser (Web Push/browser)", () => {
  const subscription = { id: "sub-1", endpoint: "https://push.example/abc", p256dh: "p256dh-key", auth: "auth-key" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("no-ops without touching the database when VAPID isn't configured", async () => {
    vi.doMock("@/lib/env", () => ({ serverEnv: { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined, VAPID_SUBJECT: undefined } }));
    const { pushWebNotificationsForUser } = await import("@/features/notifications/push");

    const result = await pushWebNotificationsForUser(userId);

    expect(result).toEqual({ sent: 0 });
    expect(mocks.prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(mocks.webPushSetVapidDetails).not.toHaveBeenCalled();
  });

  it("sends to every subscription and marks notifications pushed", async () => {
    vi.doMock("@/lib/env", () => ({ serverEnv: { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:test@example.com" } }));
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    mocks.prisma.notification.findMany.mockResolvedValue([notificationRow]);
    mocks.webPushSendNotification.mockResolvedValue(undefined);

    const { pushWebNotificationsForUser } = await import("@/features/notifications/push");
    const result = await pushWebNotificationsForUser(userId);

    expect(mocks.webPushSetVapidDetails).toHaveBeenCalledWith("mailto:test@example.com", "pub", "priv");
    expect(mocks.webPushSendNotification).toHaveBeenCalledWith(
      { endpoint: subscription.endpoint, keys: { p256dh: "p256dh-key", auth: "auth-key" } },
      expect.stringContaining(notificationRow.id),
    );
    expect(result).toEqual({ sent: 1 });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["notif-1"] } },
      data: { pushedAt: expect.any(Date) },
    });
  });

  it("prunes subscriptions the push service reports as gone (404/410)", async () => {
    vi.doMock("@/lib/env", () => ({ serverEnv: { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:test@example.com" } }));
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    mocks.prisma.notification.findMany.mockResolvedValue([notificationRow]);
    mocks.webPushSendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));

    const { pushWebNotificationsForUser } = await import("@/features/notifications/push");
    await pushWebNotificationsForUser(userId);

    expect(mocks.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [subscription.id] } } });
  });

  it("does not prune a subscription on a non-expiry error", async () => {
    vi.doMock("@/lib/env", () => ({ serverEnv: { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:test@example.com" } }));
    mocks.prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    mocks.prisma.notification.findMany.mockResolvedValue([notificationRow]);
    mocks.webPushSendNotification.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { pushWebNotificationsForUser } = await import("@/features/notifications/push");
    await pushWebNotificationsForUser(userId);

    expect(mocks.prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
