"use server";

import { revalidatePath } from "next/cache";

import { requireAppUser } from "@/features/auth/queries";
import { createTaskSchema, deleteTaskSchema, taskStatusSchema } from "@/features/tasks/schemas";
import { prisma } from "@/server/db";

function optionalDateTime(value?: string) {
  return value ? new Date(value) : undefined;
}

export async function createTask(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before adding tasks.");
  }

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

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/performance");
  if (parsed.courseId) {
    revalidatePath(`/academics/semesters/${appUser.activeSemesterId}/courses/${parsed.courseId}`);
  }
}

export async function updateTaskStatus(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before updating tasks.");
  }

  const id = String(formData.get("id") ?? "");
  const status = taskStatusSchema.parse(formData.get("status"));

  await prisma.task.updateMany({
    where: {
      id,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    data: { status },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/performance");
}

export async function deleteTask(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before deleting tasks.");
  }

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

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/performance");
  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${appUser.activeSemesterId}`);
  if (task.courseId) {
    revalidatePath(`/academics/semesters/${appUser.activeSemesterId}/courses/${task.courseId}`);
  }
}
