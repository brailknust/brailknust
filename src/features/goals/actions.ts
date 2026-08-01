"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/features/auth/queries";
import { deleteGoalSchema, goalSchema, goalStatusSchema } from "@/features/goals/schemas";
import { prisma } from "@/server/db";

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function saveGoal(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before adding goals.");

  const parsed = goalSchema.parse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    category: formData.get("category"),
    metric: formData.get("metric"),
    period: formData.get("period"),
    targetValue: formData.get("targetValue"),
    currentValue: formData.get("currentValue") || 0,
    courseId: formData.get("courseId") || undefined,
    deadline: formData.get("deadline") || undefined,
  });

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        courseId: parsed.courseId,
      },
      select: { id: true },
    });
    if (!enrollment) throw new Error("Course enrollment not found for the active semester.");
  }

  const data = {
    title: parsed.title,
    category: parsed.category,
    metric: parsed.metric,
    period: parsed.period,
    targetValue: parsed.targetValue,
    courseId: parsed.courseId ?? null,
    deadline: parsed.deadline ? new Date(parsed.deadline + "T00:00:00.000Z") : null,
    ...(parsed.metric === "MANUAL" ? { currentValue: parsed.currentValue } : {}),
  };

  if (parsed.id) {
    await prisma.goal.updateMany({
      where: {
        id: parsed.id,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
      data,
    });
  } else {
    await prisma.goal.create({
      data: {
        ...data,
        currentValue: parsed.metric === "MANUAL" ? parsed.currentValue : 0,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
    });
  }

  revalidateGoals();
}

export async function updateGoalStatus(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before updating goals.");

  const parsed = goalStatusSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  await prisma.goal.updateMany({
    where: {
      id: parsed.id,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    data: { status: parsed.status },
  });
  revalidateGoals();
}

export async function deleteGoal(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting goals.");

  const parsed = deleteGoalSchema.parse({ id: formData.get("id") });
  await prisma.goal.deleteMany({
    where: {
      id: parsed.id,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
  });
  revalidateGoals();
}
