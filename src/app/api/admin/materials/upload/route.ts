import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/features/auth/queries";
import { createAdminContentAudit } from "@/features/admin/audit";
import { chunkMaterialText } from "@/features/materials/chunking";
import { acceptedMaterialExtensions, extractCourseMaterialText, hasValidMaterialFileType, materialFileExtension } from "@/features/materials/extract";
import { uploadCourseMaterialFile } from "@/features/materials/storage";
import { materialPermissionBasisSchema, platformMaterialProvenanceSchema } from "@/features/materials/provenance";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const fieldsSchema = z.object({
  courseId: z.string().uuid(),
  topicIds: z.array(z.string().uuid()).min(1).max(20),
  title: z.string().trim().min(2).max(160),
  type: z.enum(["NOTE", "SLIDE", "PAST_QUESTION", "OTHER"]),
  permissionBasis: materialPermissionBasisSchema,
  permissionNote: z.string().trim().min(5).max(1000),
  sourceUrl: z.union([z.string().url().max(2000), z.literal("")]).optional(),
});

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

export async function POST(request: Request) {
  const { appUser } = await requireAdmin();
  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "admin-material-upload", limit: 20, windowSeconds: 3600 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "The upload could not be read. Use a file smaller than 50MB." }, { status: 413 });
  }
  const file = formData.get("file");
  const parsed = fieldsSchema.safeParse({
    courseId: formData.get("courseId"),
    topicIds: formData.getAll("topicIds"),
    title: formData.get("title"),
    type: formData.get("type"),
    permissionBasis: formData.get("permissionBasis"),
    permissionNote: formData.get("permissionNote"),
    sourceUrl: formData.get("sourceUrl") || "",
  });
  const provenance = parsed.success ? platformMaterialProvenanceSchema.safeParse(parsed.data) : null;
  if (!(file instanceof File) || !parsed.success || !provenance?.success) {
    return NextResponse.json({ message: provenance && !provenance.success ? provenance.error.issues[0]?.message : "Check the course, title, topic, provenance, and file." }, { status: 400 });
  }
  const extension = materialFileExtension(file.name);
  if (!acceptedMaterialExtensions.includes(extension)) {
    return NextResponse.json({ message: "Unsupported file type." }, { status: 415 });
  }
  if (!(await hasValidMaterialFileType(file))) {
    return NextResponse.json({ message: "The file contents do not match its extension and media type." }, { status: 415 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ message: "The file must be smaller than 50MB." }, { status: 413 });
  }
  const topics = await prisma.platformCourseTopic.findMany({
    where: { id: { in: parsed.data.topicIds }, courseId: parsed.data.courseId, isArchived: false },
    select: { id: true, courseId: true },
  });
  if (topics.length !== new Set(parsed.data.topicIds).size) {
    return NextResponse.json({ message: "Select active topics from this course outline." }, { status: 404 });
  }
  const primaryTopic = topics[0];
  const material = await prisma.platformCourseMaterial.create({
    data: {
      courseId: primaryTopic.courseId,
      topicId: primaryTopic.id,
      uploadedBy: appUser.id,
      title: parsed.data.title,
      type: parsed.data.type,
      sourceUrl: parsed.data.sourceUrl || null,
      permissionBasis: parsed.data.permissionBasis,
      permissionNote: parsed.data.permissionNote,
      originalFileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      status: "FAILED",
    },
  });
  const storagePath = `platform/${primaryTopic.courseId}/${material.id}/${safeName(file.name)}`;

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await uploadCourseMaterialFile(storagePath, bytes, file.type || "application/octet-stream");
    const text = await extractCourseMaterialText(file);
    const chunks = chunkMaterialText(text);
    if (!chunks.length || text.length < 40) throw new Error("The file did not contain enough extractable text.");

    await prisma.$transaction(async (tx) => {
      await tx.platformMaterialChunk.createMany({
        data: chunks.map((content, chunkIndex) => ({
          materialId: material.id,
          topicId: primaryTopic.id,
          chunkIndex,
          content,
          charCount: content.length,
        })),
      });
      await tx.platformCourseMaterial.update({
        where: { id: material.id },
        data: { storagePath, status: "PUBLISHED", errorMessage: null },
      });
      await tx.platformMaterialTopic.createMany({
        data: topics.map((topic) => ({ materialId: material.id, topicId: topic.id })),
        skipDuplicates: true,
      });
      await createAdminContentAudit(tx, {
        actorId: appUser.id, action: "MATERIAL_PUBLISHED", targetType: "MATERIAL",
        targetId: material.id, targetLabel: parsed.data.title,
        metadata: { courseId: primaryTopic.courseId, topicIds: topics.map((topic) => topic.id), type: parsed.data.type, permissionBasis: parsed.data.permissionBasis, chunkCount: chunks.length, fileSize: file.size },
      });
    });
    return NextResponse.json({ message: `Published ${chunks.length} searchable chunks.` });
  } catch (error) {
    console.error("Platform material processing failed", error);
    const message = "The material could not be processed. Check the file and try again.";
    await prisma.$transaction(async (tx) => {
      await tx.platformCourseMaterial.update({ where: { id: material.id }, data: { storagePath, status: "FAILED", errorMessage: message.slice(0, 500) } });
      await createAdminContentAudit(tx, {
        actorId: appUser.id, action: "MATERIAL_PROCESSING_FAILED", targetType: "MATERIAL",
        targetId: material.id, targetLabel: parsed.data.title,
        metadata: { courseId: primaryTopic.courseId, type: parsed.data.type, permissionBasis: parsed.data.permissionBasis, fileSize: file.size },
      });
    });
    return NextResponse.json({ message }, { status: 422 });
  }
}
