import { z } from "zod";

const goalCategories = ["ACADEMIC", "STUDY_TIME", "COURSE_MASTERY", "TASKS", "PERSONAL"] as const;
const goalMetrics = ["MANUAL", "CWA", "STUDY_MINUTES", "TASKS_COMPLETED", "ASSESSMENT_AVERAGE", "COURSE_MASTERY", "QUESTIONS_COMPLETED"] as const;
const goalTypes = ["ACADEMIC_CWA", "COURSE_STUDY_TIME", "COURSE_MASTERY", "PRACTICE_QUESTIONS"] as const;
const goalPeriods = ["SEMESTER", "WEEKLY"] as const;

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  goalType: z.enum(goalTypes),
  category: z.enum(goalCategories),
  metric: z.enum(goalMetrics),
  period: z.enum(goalPeriods),
  targetValue: z.coerce.number().positive().max(1000000),
  currentValue: z.coerce.number().min(0).max(1000000).default(0),
  courseId: z.string().uuid().optional(),
  deadline: z.string().optional(),
}).superRefine((value, ctx) => {
  if (["COURSE_STUDY_TIME", "COURSE_MASTERY", "PRACTICE_QUESTIONS"].includes(value.goalType) && !value.courseId) ctx.addIssue({ code: "custom", path: ["courseId"], message: "Choose a course for this goal type." });
  if (["ACADEMIC_CWA", "COURSE_MASTERY"].includes(value.goalType) && value.targetValue > 100) ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Percentage targets must be 100 or less." });
  if (value.goalType === "PRACTICE_QUESTIONS" && !Number.isInteger(value.targetValue)) ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Question targets must be whole numbers." });
  if (value.period === "WEEKLY" && value.deadline) ctx.addIssue({ code: "custom", path: ["deadline"], message: "Weekly goals reset automatically and do not use a deadline." });
});

export const goalStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "COMPLETED", "MISSED", "PAUSED", "ARCHIVED"]),
});

export const deleteGoalSchema = z.object({
  id: z.string().uuid(),
});
