import { z } from "zod";

const validDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const assessmentSchema = z.object({
  id: z.string().uuid().optional(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  type: z.enum(["QUIZ", "ASSIGNMENT", "LAB", "PROJECT", "MIDSEM", "EXAM", "OTHER"]),
  score: z.coerce.number().min(0).max(100000),
  maxScore: z.coerce.number().positive().max(100000),
  weight: z.coerce.number().positive().max(100).optional(),
  assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid assessment date.").refine(validDate, "Enter a valid assessment date.").optional(),
}).refine((value) => value.score <= value.maxScore, {
  message: "Score cannot exceed maximum score.",
  path: ["score"],
});

export const deleteAssessmentSchema = z.object({
  id: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
});
