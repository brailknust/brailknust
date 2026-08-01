"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/features/auth/queries";
import {
  createAiConversationSchema,
  deleteAiConversationSchema,
  renameAiConversationSchema,
} from "@/features/ai/schemas";
import { prisma } from "@/server/db";

export async function createAiConversation(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before creating chats.");

  const parsed = createAiConversationSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
  });
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: parsed.enrollmentId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    include: { course: { select: { name: true } } },
  });
  if (!enrollment) throw new Error("Select a course from your active semester.");

  const conversation = await prisma.aiConversation.create({
    data: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      enrollmentId: enrollment.id,
      title: `${enrollment.course.name} conversation`,
    },
  });

  revalidatePath("/ai-chat");
  redirect(`/ai-chat?conversation=${conversation.id}`);
}

export async function renameAiConversation(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before updating chats.");

  const parsed = renameAiConversationSchema.parse({
    conversationId: formData.get("conversationId"),
    title: formData.get("title"),
  });

  await prisma.aiConversation.updateMany({
    where: {
      id: parsed.conversationId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      isPinned: false,
    },
    data: { title: parsed.title },
  });
  revalidatePath("/ai-chat");
}

export async function deleteAiConversation(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting chats.");

  const parsed = deleteAiConversationSchema.parse({
    conversationId: formData.get("conversationId"),
  });

  await prisma.aiConversation.deleteMany({
    where: {
      id: parsed.conversationId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      isPinned: false,
    },
  });
  revalidatePath("/ai-chat");
}
