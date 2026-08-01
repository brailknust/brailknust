import { z } from "zod";

export const generateDiagnosticSchema = z.object({
  enrollmentId: z.string().uuid(),
  topicId: z.string().uuid(),
  questionCount: z.coerce.number().int().min(4).max(10),
});

export const generatedQuestionSetSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string().trim().min(10).max(1000),
    options: z.array(z.string().trim().min(1).max(400)).length(4),
    correctAnswer: z.enum(["A", "B", "C", "D"]),
    explanation: z.string().trim().min(10).max(1000),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    sourceRefs: z.array(z.string().regex(/^S\d+$/)).max(3),
  })).min(4).max(10),
});
