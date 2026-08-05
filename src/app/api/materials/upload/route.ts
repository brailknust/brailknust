import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { chunkMaterialText } from "@/features/materials/chunking";
import {
  acceptedMaterialExtensions,
  extractCourseMaterialText,
  hasValidMaterialFileType,
  materialFileExtension,
} from "@/features/materials/extract";
import { uploadCourseMaterialFile } from "@/features/materials/storage";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxDocumentSize = 50 * 1024 * 1024;
const maxImageSize = 6 * 1024 * 1024;

const uploadFieldsSchema = z.object({
  enrollmentId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  type: z.enum(["NOTE", "SLIDE", "PAST_QUESTION", "OTHER"]),
  topic: z.string().trim().max(120).optional(),
});

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

export async function POST(request: Request) {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.json({ message: "Sign in before uploading material." }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.json({ message: "Complete onboarding first." }, { status: 403 });

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "material-upload", limit: 10, windowSeconds: 3600 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Could not parse course material upload", error);
    return NextResponse.json(
      { message: "The upload could not be read. Make sure the file is smaller than 50MB and try again." },
      { status: 413 },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Choose a course material file." }, { status: 400 });
  }

  const parsed = uploadFieldsSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    type: formData.get("type"),
    topic: formData.get("topic") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ message: "Check the material title, type, and topic." }, { status: 400 });
  }

  const extension = materialFileExtension(file.name);
  if (!acceptedMaterialExtensions.includes(extension)) {
    return NextResponse.json(
      { message: "Upload PDF, DOCX, PPTX, TXT, MD, PNG, JPG, or WEBP." },
      { status: 415 },
    );
  }
  if (!(await hasValidMaterialFileType(file))) {
    return NextResponse.json(
      { message: "The file contents do not match its extension and media type." },
      { status: 415 },
    );
  }
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(extension);
  const sizeLimit = isImage ? maxImageSize : maxDocumentSize;
  if (file.size > sizeLimit) {
    return NextResponse.json(
      { message: `The file must be smaller than ${Math.round(sizeLimit / 1024 / 1024)}MB.` },
      { status: 413 },
    );
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: parsed.data.enrollmentId,
      userId: appUser.id,
      semesterId: parsed.data.semesterId,
      courseId: parsed.data.courseId,
    },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ message: "Course enrollment not found." }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const existing = await prisma.courseMaterial.findFirst({
    where: { enrollmentId: enrollment.id, contentHash, status: { not: "FAILED" } },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json(
      { message: "This material is already uploaded for the selected course.", materialId: existing.id, status: existing.status },
      { status: 409 },
    );
  }

  const material = await prisma.courseMaterial.create({
    data: {
      enrollmentId: enrollment.id,
      uploadedBy: appUser.id,
      title: parsed.data.title,
      type: parsed.data.type,
      originalFileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      contentHash,
      status: "PENDING",
    },
    select: { id: true },
  });
  const storagePath = `${appUser.id}/${enrollment.id}/${material.id}/${safeFileName(file.name)}`;

  try {
    await uploadCourseMaterialFile(
      storagePath,
      bytes,
      file.type || "application/octet-stream",
    );
    await prisma.courseMaterial.update({
      where: { id: material.id },
      data: { storagePath },
    });

    const extractedText = await extractCourseMaterialText(file);
    const chunks = chunkMaterialText(extractedText);
    if (!chunks.length || extractedText.length < 40) {
      throw new Error("The file did not contain enough extractable text.");
    }

    await prisma.$transaction(async (tx) => {
      const topic = parsed.data.topic
        ? await tx.courseTopic.upsert({
            where: {
              enrollmentId_title: {
                enrollmentId: enrollment.id,
                title: parsed.data.topic,
              },
            },
            update: {},
            create: {
              enrollmentId: enrollment.id,
              title: parsed.data.topic,
            },
            select: { id: true },
          })
        : null;

      await tx.materialChunk.createMany({
        data: chunks.map((content, chunkIndex) => ({
          materialId: material.id,
          topicId: topic?.id ?? null,
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

    return NextResponse.json({
      message: `Material processed into ${chunks.length} searchable chunks.`,
      materialId: material.id,
      chunkCount: chunks.length,
    });
  } catch (error) {
    console.error("Course material processing failed", error);
    const message = "The material could not be processed. Check the file and try again.";
    await prisma.courseMaterial.update({
      where: { id: material.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 500) },
    });
    return NextResponse.json({ message, materialId: material.id }, { status: 422 });
  }
}
