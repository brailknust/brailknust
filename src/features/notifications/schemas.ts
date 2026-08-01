import { z } from "zod";

export const notificationIdSchema = z.object({
  id: z.string().uuid(),
});

export const notificationReadSchema = z.object({
  id: z.string().uuid(),
  isRead: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const notificationPreferencesSchema = z.object({
  taskDeadlines: z.boolean(),
  studySessions: z.boolean(),
  groupUpdates: z.boolean(),
  goalDeadlines: z.boolean(),
  qaAnswers: z.boolean(),
  studySessionReminderMinutes: z.coerce.number().int().refine(
    (value) => [5, 10, 15, 30, 60].includes(value),
    "Choose a valid study-session reminder time.",
  ),
  reminderHours: z.coerce.number().int().refine(
    (value) => [1, 6, 12, 24, 48, 72, 168].includes(value),
    "Choose a valid reminder window.",
  ),
});
