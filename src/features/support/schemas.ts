import { z } from "zod";

export const supportRequestSchema = z.object({
  subject: z.string().trim().min(3, "Add a short subject.").max(160),
  message: z.string().trim().min(10, "Add at least 10 characters so support can help.").max(5000),
});
