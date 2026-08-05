import { z } from "zod";

export const diagnosticFeedbackSchema = z.object({
  quizId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1_000).optional(),
});
