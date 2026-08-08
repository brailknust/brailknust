import "server-only";

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
