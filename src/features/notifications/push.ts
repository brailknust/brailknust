import "server-only";

import webpush from "web-push";

import { serverEnv } from "@/lib/env";
import { prisma } from "@/server/db";

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";
const expoPushChunkSize = 100;
const maxNotificationsPerBatch = 10;

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

/**
 * Sends a batch of Expo push messages, chunked to Expo's 100-per-request
 * limit. Returns one ticket per message, in the same order, so callers can
 * correlate failures (e.g. a stale token) back to the message that produced
 * them.
 */
async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += expoPushChunkSize) {
    const chunk = messages.slice(i, i + expoPushChunkSize);
    try {
      const res = await fetch(expoPushEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error("Expo push send failed", { status: res.status });
        tickets.push(
          ...chunk.map(() => ({ status: "error" as const, message: `HTTP ${res.status}` })),
        );
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
      tickets.push(
        ...(json?.data ?? chunk.map(() => ({ status: "error" as const, message: "No ticket returned" }))),
      );
    } catch (error) {
      console.error("Expo push request failed", { error });
      tickets.push(...chunk.map(() => ({ status: "error" as const, message: "Request failed" })));
    }
  }

  return tickets;
}

/**
 * Pushes each device registered to `userId` a notification for their most
 * recent unpushed reminders, then marks those notifications as pushed so
 * later cron runs don't resend them. No-ops cheaply if the user has no
 * registered devices or nothing new to push.
 */
export async function pushPendingNotificationsForUser(userId: string) {
  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  if (tokens.length === 0) return { sent: 0 };

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      pushedAt: null,
      status: { in: ["PENDING", "DELIVERED"] },
      scheduledFor: { lte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: maxNotificationsPerBatch,
    select: { id: true, title: true, message: true, actionUrl: true },
  });
  if (notifications.length === 0) return { sent: 0 };

  const messages: ExpoPushMessage[] = [];
  const messageTokens: string[] = [];
  for (const notification of notifications) {
    for (const { token } of tokens) {
      messages.push({
        to: token,
        title: notification.title,
        body: notification.message,
        data: { notificationId: notification.id, actionUrl: notification.actionUrl ?? undefined },
      });
      messageTokens.push(token);
    }
  }

  const tickets = await sendExpoPushNotifications(messages);

  const staleTokens = new Set<string>();
  tickets.forEach((ticket, index) => {
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      staleTokens.add(messageTokens[index]);
    }
  });
  if (staleTokens.size > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: [...staleTokens] } } });
  }

  await prisma.notification.updateMany({
    where: { id: { in: notifications.map((n) => n.id) } },
    data: { pushedAt: new Date() },
  });

  return { sent: notifications.length };
}

let vapidConfigured = false;

/** Configures web-push's VAPID identity once per process. No-ops (returns
 * false) if the VAPID_* env vars aren't set — web push is opt-in infrastructure,
 * so its absence shouldn't break the rest of the notification pipeline. */
function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  if (!serverEnv.VAPID_PUBLIC_KEY || !serverEnv.VAPID_PRIVATE_KEY || !serverEnv.VAPID_SUBJECT) return false;
  webpush.setVapidDetails(serverEnv.VAPID_SUBJECT, serverEnv.VAPID_PUBLIC_KEY, serverEnv.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * The browser counterpart to pushPendingNotificationsForUser: sends each
 * registered PushSubscription the user's most recent unpushed reminders via
 * Web Push (VAPID), then marks those notifications pushed — sharing the same
 * `pushedAt` gate as the Expo path, so a row already delivered to a phone
 * isn't re-sent here too. Prunes subscriptions the push service reports as
 * gone (404/410, per the Web Push spec — the browser equivalent of Expo's
 * DeviceNotRegistered).
 */
export async function pushWebNotificationsForUser(userId: string) {
  if (!ensureVapidConfigured()) return { sent: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return { sent: 0 };

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      pushedAt: null,
      status: { in: ["PENDING", "DELIVERED"] },
      scheduledFor: { lte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: maxNotificationsPerBatch,
    select: { id: true, title: true, message: true, actionUrl: true },
  });
  if (notifications.length === 0) return { sent: 0 };

  const staleSubscriptionIds = new Set<string>();
  let sent = 0;

  for (const notification of notifications) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      openUrl: notification.actionUrl ?? "/notifications",
      notificationId: notification.id,
    });
    for (const subscription of subscriptions) {
      if (staleSubscriptionIds.has(subscription.id)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.add(subscription.id);
        } else {
          console.error("Web push send failed", { userId, error });
        }
      }
    }
  }

  if (staleSubscriptionIds.size > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: [...staleSubscriptionIds] } } });
  }

  await prisma.notification.updateMany({
    where: { id: { in: notifications.map((n) => n.id) } },
    data: { pushedAt: new Date() },
  });

  return { sent };
}
