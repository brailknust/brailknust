"use server";

import { revalidatePath } from "next/cache";

import { requireAppUser } from "@/features/auth/queries";
import {
  notificationIdSchema,
  notificationPreferencesSchema,
  notificationReadSchema,
} from "@/features/notifications/schemas";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";

function refreshNotifications() {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

export async function updateNotificationReadState(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = notificationReadSchema.parse({
    id: formData.get("id"),
    isRead: formData.get("isRead"),
  });

  await prisma.notification.updateMany({
    where: { id: parsed.id, userId: appUser.id },
    data: {
      isRead: parsed.isRead,
      readAt: parsed.isRead ? new Date() : null,
      status: parsed.isRead ? "READ" : "DELIVERED",
    },
  });
  refreshNotifications();
}

export async function markAllNotificationsRead() {
  const { appUser } = await requireAppUser();
  await prisma.notification.updateMany({
    where: { userId: appUser.id, isRead: false, status: { in: ["PENDING", "DELIVERED"] } },
    data: { isRead: true, readAt: new Date(), status: "READ" },
  });
  refreshNotifications();
}

export async function deleteNotification(formData: FormData) {
  const { appUser } = await requireAppUser();
  const { id } = notificationIdSchema.parse({ id: formData.get("id") });
  await prisma.notification.updateMany({
    where: { id, userId: appUser.id },
    data: { isRead: true, readAt: new Date(), dismissedAt: new Date(), status: "DISMISSED" },
  });
  refreshNotifications();
}

export async function updateNotificationPreferences(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = notificationPreferencesSchema.parse({
    taskDeadlines: formData.get("taskDeadlines") === "on",
    studySessions: formData.get("studySessions") === "on",
    groupUpdates: formData.get("groupUpdates") === "on",
    goalDeadlines: formData.get("goalDeadlines") === "on",
    qaAnswers: formData.get("qaAnswers") === "on",
    reminderHours: formData.get("reminderHours"),
    studySessionReminderMinutes: formData.get("studySessionReminderMinutes"),
  });

  await prisma.notificationPreference.upsert({
    where: { userId: appUser.id },
    create: { userId: appUser.id, ...parsed },
    update: { ...parsed, lastSyncedAt: null },
  });
  await syncNotificationsForUser(appUser.id, true);
  refreshNotifications();
}
