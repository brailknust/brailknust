import { z } from "zod";

export const assessmentSchema = z.object({
  id: z.string().uuid().optional(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  type: z.enum(["QUIZ", "ASSIGNMENT", "LAB", "PROJECT", "MIDSEM", "EXAM", "OTHER"]),
  score: z.coerce.number().min(0).max(100000),
  maxScore: z.coerce.number().positive().max(100000),
  weight: z.coerce.number().positive().max(100).optional(),
  assessedAt: z.string().optional(),
}).refine((value) => value.score <= value.maxScore, {
  message: "Score cannot exceed maximum score.",
  path: ["score"],
});

export const deleteAssessmentSchema = z.object({
  id: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
});
