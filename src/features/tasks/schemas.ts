import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  courseId: z.string().uuid().optional(),
  dueAt: z.string().optional(),
  reminderAt: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const updateTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
});

export const taskStatusSchema = z.enum(["TODO", "DONE"]);

export const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});
