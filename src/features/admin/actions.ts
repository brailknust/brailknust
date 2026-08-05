"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/auth/queries";
import { removeCourseMaterialFile } from "@/features/materials/storage";
import { finalizeAccountDeletionCleanup } from "@/features/profile/account-deletion";
import { prisma } from "@/server/db";
import { z } from "zod";

const adminUserSchema = z.object({ userId: z.string().uuid() });
const courseApprovalSchema = z.object({ courseId: z.string().uuid() });
const supportStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
});
const feedbackStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["NEW", "REVIEWED", "PLANNED", "CLOSED"]),
});

export async function updateSupportRequestStatus(formData: FormData) {
  await requireAdmin();
  const parsed = supportStatusSchema.parse({ id: formData.get("id"), status: formData.get("status") });
  await prisma.supportRequest.update({ where: { id: parsed.id }, data: { status: parsed.status } });
  revalidatePath("/admin/feedback");
}

export async function updateFeedbackStatus(formData: FormData) {
  await requireAdmin();
  const parsed = feedbackStatusSchema.parse({ id: formData.get("id"), status: formData.get("status") });
  await prisma.feedback.update({ where: { id: parsed.id }, data: { status: parsed.status } });
  revalidatePath("/admin/feedback");
}

export async function approveStudentCourse(formData: FormData) {
  await requireAdmin();
  const { courseId } = courseApprovalSchema.parse({ courseId: formData.get("courseId") });
  await prisma.course.updateMany({
    where: { id: courseId, approvalStatus: { in: ["PENDING", "REJECTED"] } },
    data: { approvalStatus: "OFFICIAL", createdById: null },
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/academics");
}

export async function rejectStudentCourse(formData: FormData) {
  await requireAdmin();
  const { courseId } = courseApprovalSchema.parse({ courseId: formData.get("courseId") });
  await prisma.course.updateMany({
    where: { id: courseId, approvalStatus: "PENDING", createdById: { not: null } },
    data: { approvalStatus: "REJECTED" },
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/academics");
}

export async function grantAdminRole(formData: FormData) {
  const { appUser } = await requireAdmin();
  const { userId } = adminUserSchema.parse({ userId: formData.get("userId") });

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { role: true } });
    if (!target) throw new Error("User not found.");
    if (target.role === "ADMIN") return;

    await tx.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    await tx.adminRoleAudit.create({
      data: { actorId: appUser.id, targetUserId: userId, action: "GRANTED" },
    });
  });

  revalidatePath("/admin/users");
}

export async function revokeAdminRole(formData: FormData) {
  const { appUser } = await requireAdmin();
  const { userId } = adminUserSchema.parse({ userId: formData.get("userId") });

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { role: true } });
    if (!target) throw new Error("User not found.");
    if (target.role !== "ADMIN") return;

    const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) throw new Error("The final administrator cannot be removed.");

    await tx.user.update({ where: { id: userId }, data: { role: "STUDENT" } });
    await tx.adminRoleAudit.create({
      data: { actorId: appUser.id, targetUserId: userId, action: "REVOKED" },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
}

export async function retryAccountDeletionCleanup(formData: FormData) {
  await requireAdmin();
  const { userId } = adminUserSchema.parse({ userId: formData.get("userId") });
  const completed = await finalizeAccountDeletionCleanup(userId);
  if (!completed) throw new Error("Account cleanup could not be completed. Try again after checking the external services.");
  revalidatePath("/admin/users");
}

export async function deletePlatformMaterial(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const material = await prisma.platformCourseMaterial.findUnique({
    where: { id },
    select: { id: true, storagePath: true, courseId: true },
  });
  if (!material) return;
  if (material.storagePath) await removeCourseMaterialFile(material.storagePath);
  await prisma.platformCourseMaterial.delete({ where: { id: material.id } });
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${material.courseId}/topics`);
}

const topicSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  learningOutcomes: z.string().trim().max(3000).optional(),
  sequence: z.coerce.number().int().min(0).max(999),
});

const programmeCourseSchema = z.object({
  college: z.string().trim().min(2).max(200),
  programme: z.string().trim().min(2).max(200),
  department: z.string().trim().min(2).max(200),
  level: z.enum(["LEVEL_100", "LEVEL_200", "LEVEL_300", "LEVEL_400", "LEVEL_500", "LEVEL_600"]),
  semester: z.enum(["First Semester", "Second Semester"]),
  courseCode: z.string().trim().min(2).max(30),
});

export async function removeProgrammeCourse(formData: FormData) {
  const { appUser } = await requireAdmin();
  const parsed = programmeCourseSchema.parse({
    college: formData.get("college"),
    programme: formData.get("programme"),
    department: formData.get("department"),
    level: formData.get("level"),
    semester: formData.get("semester"),
    courseCode: formData.get("courseCode"),
  });
  await prisma.programmeCourseExclusion.upsert({
    where: {
      programme_level_semester_courseCode: {
        programme: parsed.programme,
        level: parsed.level,
        semester: parsed.semester,
        courseCode: parsed.courseCode,
      },
    },
    create: { ...parsed, removedById: appUser.id },
    update: { removedById: appUser.id, college: parsed.college, department: parsed.department },
  });
  revalidatePath("/admin/catalog");
}

export async function restoreProgrammeCourse(formData: FormData) {
  await requireAdmin();
  const parsed = programmeCourseSchema.pick({
    programme: true,
    level: true,
    semester: true,
    courseCode: true,
  }).parse({
    programme: formData.get("programme"),
    level: formData.get("level"),
    semester: formData.get("semester"),
    courseCode: formData.get("courseCode"),
  });
  await prisma.programmeCourseExclusion.deleteMany({ where: parsed });
  revalidatePath("/admin/catalog");
}

export async function deleteOrphanCatalogCourse(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("courseId"));
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      _count: {
        select: {
          enrollments: true,
          assessments: true,
          goals: true,
          groups: true,
          resources: true,
          studyItems: true,
          tasks: true,
          timetable: true,
          weakAreas: true,
          peerQuestions: true,
          platformMaterials: true,
          platformTopics: true,
        },
      },
    },
  });
  if (!course) return;
  const references = Object.values(course._count).reduce((total, count) => total + count, 0);
  if (references > 0) {
    throw new Error(`${course.code} cannot be deleted because it already has student or platform records.`);
  }
  await prisma.course.delete({ where: { id: course.id } });
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/content");
}

export async function createPlatformTopic(formData: FormData) {
  await requireAdmin();
  const parsed = topicSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    learningOutcomes: formData.get("learningOutcomes") || undefined,
    sequence: formData.get("sequence") || 0,
  });
  if (!parsed.success) throw new Error("Check the topic details.");
  await prisma.platformCourseTopic.create({ data: parsed.data });
  revalidatePath(`/admin/content/${parsed.data.courseId}/topics`);
}

export async function updatePlatformTopic(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const parsed = topicSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    learningOutcomes: formData.get("learningOutcomes") || undefined,
    sequence: formData.get("sequence") || 0,
  });
  if (!parsed.success) throw new Error("Check the topic details.");
  await prisma.platformCourseTopic.update({
    where: { id, courseId: parsed.data.courseId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      learningOutcomes: parsed.data.learningOutcomes ?? null,
      sequence: parsed.data.sequence,
    },
  });
  revalidatePath(`/admin/content/${parsed.data.courseId}/topics`);
  revalidatePath("/practice");
}

export async function togglePlatformTopicArchive(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const isArchived = formData.get("isArchived") === "true";
  await prisma.platformCourseTopic.update({
    where: { id, courseId },
    data: { isArchived: !isArchived },
  });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/practice");
}

export async function deletePlatformTopic(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const topic = await prisma.platformCourseTopic.findFirst({
    where: { id, courseId },
    select: {
      id: true,
      _count: {
        select: {
          materials: true,
          materialLinks: true,
          diagnosticQuestions: true,
          topicMasteries: true,
        },
      },
    },
  });
  if (!topic) return;
  if (
    topic._count.materials > 0
    || topic._count.materialLinks > 0
    || topic._count.diagnosticQuestions > 0
    || topic._count.topicMasteries > 0
  ) {
    throw new Error("Remove its materials and diagnostic history, or merge/archive this topic instead.");
  }
  await prisma.platformCourseTopic.delete({ where: { id: topic.id } });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/admin/content");
  revalidatePath("/practice");
}

export async function mergePlatformTopics(formData: FormData) {
  await requireAdmin();
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const sourceId = z.string().uuid().parse(formData.get("sourceId"));
  const targetId = z.string().uuid().parse(formData.get("targetId"));
  if (sourceId === targetId) throw new Error("Choose a different destination topic.");

  await prisma.$transaction(async (tx) => {
    const topics = await tx.platformCourseTopic.findMany({
      where: { id: { in: [sourceId, targetId] }, courseId },
      select: { id: true },
    });
    if (topics.length !== 2) throw new Error("Topic not found.");

    const sourceMasteries = await tx.topicMastery.findMany({ where: { platformTopicId: sourceId } });
    for (const mastery of sourceMasteries) {
      const existing = await tx.topicMastery.findUnique({
        where: {
          userId_enrollmentId_platformTopicId: {
            userId: mastery.userId,
            enrollmentId: mastery.enrollmentId,
            platformTopicId: targetId,
          },
        },
      });
      const attemptCount = mastery.attemptCount + (existing?.attemptCount ?? 0);
      const correctCount = mastery.correctCount + (existing?.correctCount ?? 0);
      const masteryScore = attemptCount ? Math.round((correctCount / attemptCount) * 10000) / 100 : 0;
      if (existing) {
        await tx.topicMastery.update({
          where: { id: existing.id },
          data: { attemptCount, correctCount, masteryScore },
        });
        await tx.topicMastery.delete({ where: { id: mastery.id } });
      } else {
        await tx.topicMastery.update({
          where: { id: mastery.id },
          data: { platformTopicId: targetId, masteryScore },
        });
      }
    }
    await tx.platformCourseMaterial.updateMany({ where: { topicId: sourceId }, data: { topicId: targetId } });
    await tx.platformMaterialChunk.updateMany({ where: { topicId: sourceId }, data: { topicId: targetId } });
    const sourceLinks = await tx.platformMaterialTopic.findMany({
      where: { topicId: sourceId },
      select: { materialId: true },
    });
    await tx.platformMaterialTopic.createMany({
      data: sourceLinks.map((link) => ({ materialId: link.materialId, topicId: targetId })),
      skipDuplicates: true,
    });
    await tx.platformMaterialTopic.deleteMany({ where: { topicId: sourceId } });
    await tx.diagnosticQuestion.updateMany({ where: { platformTopicId: sourceId }, data: { platformTopicId: targetId } });
    await tx.platformCourseTopic.delete({ where: { id: sourceId } });
  });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/practice");
}
