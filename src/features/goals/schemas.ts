import { z } from "zod";

const goalCategories = ["ACADEMIC", "STUDY_TIME", "COURSE_MASTERY", "TASKS", "PERSONAL"] as const;
const goalMetrics = ["MANUAL", "CWA", "STUDY_MINUTES", "TASKS_COMPLETED", "ASSESSMENT_AVERAGE"] as const;
const goalPeriods = ["SEMESTER", "WEEKLY"] as const;

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  category: z.enum(goalCategories),
  metric: z.enum(goalMetrics),
  period: z.enum(goalPeriods),
  targetValue: z.coerce.number().positive().max(1000000),
  currentValue: z.coerce.number().min(0).max(1000000).default(0),
  courseId: z.string().uuid().optional(),
  deadline: z.string().optional(),
});

export const goalStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]),
});

export const deleteGoalSchema = z.object({
  id: z.string().uuid(),
});
