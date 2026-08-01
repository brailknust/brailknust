import { z } from "zod";

export const sendAiMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  enrollmentId: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(4000),
}).refine((value) => value.conversationId || value.enrollmentId, {
  message: "Select a course before sending a message.",
});

export const createAiConversationSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const renameAiConversationSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().trim().min(2).max(100),
});

export const deleteAiConversationSchema = z.object({
  conversationId: z.string().uuid(),
});
