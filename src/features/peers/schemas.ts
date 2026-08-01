import { z } from "zod";

export const createStudyGroupSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  courseId: z.string().uuid(),
  maxMembers: z.coerce.number().int().min(2).max(100),
  meetingAt: z.string().optional().refine(
    (value) => !value || !Number.isNaN(new Date(value).getTime()),
    "Enter a valid meeting date and time.",
  ),
  meetingPlace: z.string().trim().max(200).optional(),
});

export const updateStudyGroupSchema = createStudyGroupSchema
  .omit({ courseId: true })
  .extend({
    groupId: z.string().uuid(),
  });

export const groupMembershipSchema = z.object({
  groupId: z.string().uuid(),
});

export const deleteStudyGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export const peerQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(8).max(200),
  body: z.string().trim().min(20).max(5000),
  courseId: z.string().uuid().optional(),
});

export const peerAnswerSchema = z.object({
  id: z.string().uuid().optional(),
  questionId: z.string().uuid(),
  body: z.string().trim().min(2).max(5000),
});

export const peerQuestionIdSchema = z.object({
  questionId: z.string().uuid(),
});

export const peerAnswerIdSchema = z.object({
  answerId: z.string().uuid(),
  questionId: z.string().uuid(),
});