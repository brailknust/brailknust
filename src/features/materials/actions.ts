"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireWritableSemester } from "@/features/academics/semester-state";
import { requireAppUser } from "@/features/auth/queries";
import { chunkMaterialText } from "@/features/materials/chunking";
import { extractCourseMaterialText } from "@/features/materials/extract";
import {
  deleteCourseMaterialSchema,
  retryCourseMaterialSchema,
  saveCourseMaterialSchema,
} from "@/features/materials/schemas";
import { downloadCourseMaterialFile, removeCourseMaterialFile } from "@/features/materials/storage";
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
  await requireWritableSemester(appUser.id, parsed.semesterId);

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
  await requireWritableSemester(appUser.id, parsed.semesterId);

  if (material.storagePath) {
    await removeCourseMaterialFile(material.storagePath);
  }
  await prisma.courseMaterial.delete({ where: { id: material.id } });

  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
}

export async function retryCourseMaterialProcessing(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = retryCourseMaterialSchema.parse({
    materialId: formData.get("materialId"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
  });
  const material = await prisma.courseMaterial.findFirst({
    where: {
      id: parsed.materialId,
      uploadedBy: appUser.id,
      status: "FAILED",
      enrollment: {
        userId: appUser.id,
        semesterId: parsed.semesterId,
        courseId: parsed.courseId,
      },
    },
    select: {
      id: true,
      storagePath: true,
      originalFileName: true,
      mimeType: true,
    },
  });
  if (!material) throw new Error("Failed material not found.");
  if (!material.storagePath) throw new Error("The original file is unavailable. Upload it again to retry.");
  await requireWritableSemester(appUser.id, parsed.semesterId);

  await prisma.courseMaterial.update({
    where: { id: material.id },
    data: { status: "PENDING", errorMessage: null },
  });

  try {
    const original = await downloadCourseMaterialFile(material.storagePath);
    const file = new File(
      [await original.arrayBuffer()],
      material.originalFileName ?? "course-material",
      { type: material.mimeType ?? "application/octet-stream" },
    );
    const extractedText = await extractCourseMaterialText(file);
    const chunks = chunkMaterialText(extractedText);
    if (!chunks.length || extractedText.length < 40) {
      throw new Error("The file did not contain enough extractable text.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.materialChunk.deleteMany({ where: { materialId: material.id } });
      await tx.materialChunk.createMany({
        data: chunks.map((content, chunkIndex) => ({
          materialId: material.id,
          chunkIndex,
          content,
          charCount: content.length,
        })),
      });
      await tx.courseMaterial.update({
        where: { id: material.id },
        data: { status: "READY", errorMessage: null },
      });
    });
  } catch (error) {
    console.error("Course material retry failed", error);
    await prisma.courseMaterial.update({
      where: { id: material.id },
      data: {
        status: "FAILED",
        errorMessage: "The material could not be processed. Check the file and try again.",
      },
    });
  }

  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
}
