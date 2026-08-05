"use server";

import { revalidatePath } from "next/cache";

import { requireActiveWritableSemester } from "@/features/academics/semester-state";
import { parseAccraDateTime } from "@/features/academics/time";
import { requireAppUser } from "@/features/auth/queries";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";
import { createTaskSchema, deleteTaskSchema, taskStatusSchema, updateTaskSchema } from "@/features/tasks/schemas";
import { canTransitionTaskStatus, withEffectiveTaskStatus } from "@/features/tasks/status";
import { prisma } from "@/server/db";

function optionalDateTime(value?: string) {
  return parseAccraDateTime(value);
}

function revalidateTaskViews(activeSemesterId: string, courseIds: Array<string | null | undefined> = []) {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/performance");
  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${activeSemesterId}`);
  for (const courseId of new Set(courseIds.filter(Boolean))) {
    revalidatePath(`/academics/semesters/${activeSemesterId}/courses/${courseId}`);
  }
}

export async function createTask(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before adding tasks.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = createTaskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    courseId: formData.get("courseId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    reminderAt: formData.get("reminderAt") || undefined,
    priority: formData.get("priority") || "MEDIUM",
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

    if (!enrollment) {
      throw new Error("Select a course from the active semester.");
    }
  }

  await prisma.task.create({
    data: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      courseId: parsed.courseId,
      title: parsed.title,
      description: parsed.description,
      dueAt: optionalDateTime(parsed.dueAt),
      reminderAt: optionalDateTime(parsed.reminderAt),
      priority: parsed.priority,
    },
  });

  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateTaskViews(appUser.activeSemesterId, [parsed.courseId]);
}

export async function updateTaskStatus(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before updating tasks.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const id = String(formData.get("id") ?? "");
  const status = taskStatusSchema.parse(formData.get("status"));
  const existing = await prisma.task.findFirst({
    where: {
      id,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    select: { status: true, dueAt: true, courseId: true },
  });
  if (!existing) return;

  const effectiveStatus = withEffectiveTaskStatus(existing).status;
  if (!canTransitionTaskStatus(effectiveStatus, status)) {
    throw new Error(`Task status cannot move from ${effectiveStatus.replace("_", " ")} to ${status.replace("_", " ")}.`);
  }

  await prisma.task.update({ where: { id }, data: { status } });
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateTaskViews(appUser.activeSemesterId, [existing.courseId]);
}

export async function updateTask(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before editing tasks.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = updateTaskSchema.parse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    courseId: formData.get("courseId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    reminderAt: formData.get("reminderAt") || undefined,
    priority: formData.get("priority") || "MEDIUM",
  });

  const existing = await prisma.task.findFirst({
    where: { id: parsed.id, userId: appUser.id, semesterId: appUser.activeSemesterId },
    select: { courseId: true },
  });
  if (!existing) return;

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: appUser.id, semesterId: appUser.activeSemesterId, courseId: parsed.courseId },
      select: { id: true },
    });
    if (!enrollment) throw new Error("Select a course from the active semester.");
  }

  await prisma.task.update({
    where: { id: parsed.id },
    data: {
      title: parsed.title,
      description: parsed.description,
      courseId: parsed.courseId,
      dueAt: optionalDateTime(parsed.dueAt),
      reminderAt: optionalDateTime(parsed.reminderAt),
      priority: parsed.priority,
    },
  });

  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateTaskViews(appUser.activeSemesterId, [existing.courseId, parsed.courseId]);
}

export async function deleteTask(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before deleting tasks.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const { id } = deleteTaskSchema.parse({ id: formData.get("id") });
  const task = await prisma.task.findFirst({
    where: {
      id,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    select: { courseId: true },
  });

  if (!task) return;

  await prisma.task.delete({ where: { id } });
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidateTaskViews(appUser.activeSemesterId, [task.courseId]);
}
