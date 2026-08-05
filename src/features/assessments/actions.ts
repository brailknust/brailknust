"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/features/auth/queries";
import { assessmentSchema, deleteAssessmentSchema } from "@/features/assessments/schemas";
import { prisma } from "@/server/db";

export async function saveAssessment(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = assessmentSchema.parse({
    id: formData.get("id") || undefined,
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    type: formData.get("type") || "OTHER",
    score: formData.get("score"),
    maxScore: formData.get("maxScore"),
    weight: formData.get("weight") || undefined,
    assessedAt: formData.get("assessedAt") || undefined,
  });
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
    select: { id: true },
  });
  if (!enrollment) throw new Error("Course enrollment not found for this semester.");

  const data = {
    title: parsed.title,
    type: parsed.type,
    score: parsed.score,
    maxScore: parsed.maxScore,
    weight: parsed.weight,
    assessedAt: parsed.assessedAt ? new Date(parsed.assessedAt + "T00:00:00.000Z") : undefined,
  };
  if (parsed.id) {
    const current = await prisma.assessment.findFirst({
      where: { id: parsed.id, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
      select: { weight: true },
    });
    if (!current) return;
    const weightTotal = await prisma.assessment.aggregate({
      where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId, NOT: { id: parsed.id } },
      _sum: { weight: true },
    });
    const total = Number(weightTotal._sum.weight ?? 0) + Number(parsed.weight ?? 0);
    if (total > 100) throw new Error("Assessment weights for a course cannot exceed 100%.");
    await prisma.assessment.updateMany({
      where: { id: parsed.id, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
      data,
    });
  } else {
    const weightTotal = await prisma.assessment.aggregate({
      where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
      _sum: { weight: true },
    });
    const total = Number(weightTotal._sum.weight ?? 0) + Number(parsed.weight ?? 0);
    if (total > 100) throw new Error("Assessment weights for a course cannot exceed 100%.");
    await prisma.assessment.create({
      data: { ...data, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
    });
  }
  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
  revalidatePath("/performance");
}

export async function deleteAssessment(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = deleteAssessmentSchema.parse({
    id: formData.get("id"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
  });
  await prisma.assessment.deleteMany({
    where: { id: parsed.id, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
  });
  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
  revalidatePath("/performance");
}
