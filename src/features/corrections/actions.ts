"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";

const correctionSchema = z.object({
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  target: z.string().max(50),
  details: z.string().trim().min(20).max(2000),
});

export async function submitContentCorrection(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = correctionSchema.parse({
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    target: formData.get("target"),
    details: formData.get("details"),
  });
  const [rawType, rawId] = parsed.target.split(":", 2);
  const targetType = z.enum(["COURSE", "TOPIC", "MATERIAL"]).parse(rawType);
  const targetId = targetType === "COURSE" ? parsed.courseId : z.string().uuid().parse(rawId);

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
    select: { id: true },
  });
  if (!enrollment) throw new Error("This course is not part of your semester.");

  let topicId: string | null = null;
  let materialId: string | null = null;
  if (targetType === "TOPIC") {
    const topic = await prisma.platformCourseTopic.findFirst({
      where: { id: targetId, courseId: parsed.courseId, isArchived: false },
      select: { id: true },
    });
    if (!topic) throw new Error("The selected topic is not available for this course.");
    topicId = topic.id;
  } else if (targetType === "MATERIAL") {
    const material = await prisma.platformCourseMaterial.findFirst({
      where: { id: targetId, courseId: parsed.courseId, status: "PUBLISHED" },
      select: { id: true, topicId: true },
    });
    if (!material) throw new Error("The selected material is not available for this course.");
    materialId = material.id;
    topicId = material.topicId;
  }

  await prisma.contentCorrectionRequest.create({
    data: {
      userId: appUser.id,
      courseId: parsed.courseId,
      targetType,
      topicId,
      materialId,
      details: parsed.details,
    },
  });
  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
  revalidatePath("/admin/feedback");
}
