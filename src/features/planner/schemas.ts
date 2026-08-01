import { z } from "zod";

export const createStudyPlanSchema = z.object({
  title: z.string().trim().min(2, "Enter a study plan title."),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createStudyPlanItemSchema = z
  .object({
    studyPlanId: z.string().uuid(),
    courseId: z.string().uuid().optional(),
    title: z.string().trim().min(2, "Enter a study session title."),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Select a start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Select an end time."),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const updateStudyPlanItemSchema = createStudyPlanItemSchema.and(
  z.object({ id: z.string().uuid() }),
);
export const deleteStudyPlanItemSchema = z.object({
  id: z.string().uuid(),
  studyPlanId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});

export const studyPlanItemStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]);
