import { z } from "zod";

const validDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dateField = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, label).refine(validDate, label).optional();

export const createStudyPlanSchema = z.object({
  title: z.string().trim().min(2, "Enter a study plan title."),
  startDate: dateField("Select a valid start date."),
  endDate: dateField("Select a valid end date."),
}).refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});

export const createStudyPlanItemSchema = z
  .object({
    studyPlanId: z.string().uuid(),
    courseId: z.string().uuid().optional(),
    title: z.string().trim().min(2, "Enter a study session title."),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select a start time."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select an end time."),
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
