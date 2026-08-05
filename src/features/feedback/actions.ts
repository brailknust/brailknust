"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/features/auth/queries";
import { feedbackSchema } from "@/features/feedback/schemas";
import { prisma } from "@/server/db";

export async function submitFeedback(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = feedbackSchema.parse({
    type: formData.get("type"),
    message: formData.get("message"),
  });

  await prisma.feedback.create({
    data: { userId: appUser.id, type: parsed.type, message: parsed.message },
  });

  revalidatePath("/feedback");
  redirect("/feedback?submitted=1");
}
