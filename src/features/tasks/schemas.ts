import { z } from "zod";

const optionalDateTime = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date and time.").optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  courseId: z.string().uuid().optional(),
  dueAt: optionalDateTime,
  reminderAt: optionalDateTime,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
}).refine((value) => !value.dueAt || !value.reminderAt || new Date(value.reminderAt) < new Date(value.dueAt), {
  message: "Reminder must be before the due date.",
  path: ["reminderAt"],
});

export const updateTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
});

export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);

export const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});
