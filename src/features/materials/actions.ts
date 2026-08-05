"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireAppUser } from "@/features/auth/queries";
import { chunkMaterialText } from "@/features/materials/chunking";
import {
  deleteCourseMaterialSchema,
  saveCourseMaterialSchema,
} from "@/features/materials/schemas";
import { removeCourseMaterialFile } from "@/features/materials/storage";
import { prisma } from "@/server/db";

export async function saveCourseMaterial(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = saveCourseMaterialSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    type: formData.get("type"),
    topic: formData.get("topic") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
    content: formData.get("content"),
  });

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: parsed.enrollmentId,
      userId: appUser.id,
      semesterId: parsed.semesterId,
      courseId: parsed.courseId,
    },
    select: { id: true },
  });
  if (!enrollment) throw new Error("Course enrollment not found.");

  const chunks = chunkMaterialText(parsed.content);
  if (!chunks.length) throw new Error("The material did not contain usable text.");
  const contentHash = createHash("sha256").update(parsed.content.trim()).digest("hex");
  const existing = await prisma.courseMaterial.findFirst({
    where: { enrollmentId: enrollment.id, contentHash, status: { not: "FAILED" } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const topic = parsed.topic
      ? await tx.courseTopic.upsert({
          where: {
            enrollmentId_title: {
              enrollmentId: enrollment.id,
              title: parsed.topic,
            },
          },
          update: {},
          create: {
            enrollmentId: enrollment.id,
            title: parsed.topic,
          },
          select: { id: true },
        })
      : null;

    const material = await tx.courseMaterial.create({
      data: {
        enrollmentId: enrollment.id,
        uploadedBy: appUser.id,
        title: parsed.title,
        type: parsed.type,
        sourceUrl: parsed.sourceUrl || null,
        contentHash,
        status: "READY",
      },
      select: { id: true },
    });

    await tx.materialChunk.createMany({
      data: chunks.map((content, chunkIndex) => ({
        materialId: material.id,
        topicId: topic?.id ?? null,
        chunkIndex,
        content,
        charCount: content.length,
      })),
    });
  });

  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
}

export async function deleteCourseMaterial(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = deleteCourseMaterialSchema.parse({
    materialId: formData.get("materialId"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
  });

  const material = await prisma.courseMaterial.findFirst({
    where: {
      id: parsed.materialId,
      uploadedBy: appUser.id,
      enrollment: {
        userId: appUser.id,
        semesterId: parsed.semesterId,
        courseId: parsed.courseId,
      },
    },
    select: { id: true, storagePath: true },
  });
  if (!material) return;

  if (material.storagePath) {
    await removeCourseMaterialFile(material.storagePath);
  }
  await prisma.courseMaterial.delete({ where: { id: material.id } });

  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
}
