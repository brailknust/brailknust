import { z } from "zod";

export const saveCourseMaterialSchema = z.object({
  enrollmentId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  type: z.enum(["NOTE", "SLIDE", "PAST_QUESTION", "LINK", "OTHER"]),
  topic: z.string().trim().max(120).optional(),
  sourceUrl: z.union([z.string().url().max(2000), z.literal("")]).optional(),
  content: z.string().trim().min(40).max(100_000),
});

export const deleteCourseMaterialSchema = z.object({
  materialId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export const retryCourseMaterialSchema = z.object({
  materialId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
});
