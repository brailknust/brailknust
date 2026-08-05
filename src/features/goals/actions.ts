"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWritableSemester } from "@/features/academics/semester-state";
import { parseAccraDate } from "@/features/academics/time";
import { requireAppUser } from "@/features/auth/queries";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";
import { deleteGoalSchema, goalSchema, goalStatusSchema } from "@/features/goals/schemas";
import { prisma } from "@/server/db";
import { goalTemplate } from "@/features/goals/templates";

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function saveGoal(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before adding goals.");
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = goalSchema.parse({
    id: formData.get("id") || undefined,
    title: "Automatically tracked goal",
    goalType: formData.get("goalType"),
    category: "ACADEMIC",
    metric: "CWA",
    period: formData.get("period"),
    targetValue: formData.get("targetValue"),
    currentValue: 0,
    courseId: formData.get("courseId") || undefined,
    deadline: formData.get("deadline") || undefined,
  });

  let selectedCourse: { code: string; name: string } | null = null;
  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        courseId: parsed.courseId,
      },
      select: { id: true, course: { select: { code: true, name: true } } },
    });
    if (!enrollment) throw new Error("Course enrollment not found for the active semester.");
    selectedCourse = enrollment.course;
  }
  const template = goalTemplate(parsed.goalType);
  if (template.requiresCourse && !selectedCourse) throw new Error("Choose an active-semester course for this goal.");
  if (parsed.targetValue > 5000 && parsed.period === "WEEKLY") throw new Error("That weekly target is unusually high. Use a smaller target or create a semester goal.");

  const data = {
    title: template.type === "ACADEMIC_CWA" ? `Reach a CWA of ${parsed.targetValue}%` : template.type === "COURSE_STUDY_TIME" ? `Study ${selectedCourse!.code} for ${parsed.targetValue} minutes` : template.type === "COURSE_MASTERY" ? `Reach ${parsed.targetValue}% mastery in ${selectedCourse!.name}` : `Complete ${parsed.targetValue} practice questions for ${selectedCourse!.code}`,
    goalType: parsed.goalType,
    category: template.category,
    metric: template.metric,
    period: parsed.period,
    targetValue: parsed.targetValue,
    targetUnit: template.unit,
    trackingSource: template.source,
    courseId: parsed.courseId ?? null,
    deadline: parseAccraDate(parsed.deadline) ?? null,
    ...(template.metric === "MANUAL" ? { currentValue: parsed.currentValue } : {}),
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
        currentValue: template.metric === "MANUAL" ? parsed.currentValue : 0,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
    });
  }

  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateGoals();
}

export async function updateGoalStatus(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before updating goals.");
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

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
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateGoals();
}

export async function deleteGoal(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting goals.");
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

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
