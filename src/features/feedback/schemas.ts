import { z } from "zod";

export const feedbackSchema = z.object({
  type: z.enum(["BUG", "IDEA", "PRAISE", "OTHER"]),
  message: z.string().trim().min(10, "Add at least 10 characters of feedback.").max(5000),
});
