"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/features/auth/queries";
import { supportRequestSchema } from "@/features/support/schemas";
import { prisma } from "@/server/db";

export async function submitSupportRequest(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = supportRequestSchema.parse({
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  await prisma.supportRequest.create({
    data: { userId: appUser.id, subject: parsed.subject, message: parsed.message },
  });

  revalidatePath("/support");
  redirect("/support?submitted=1");
}
