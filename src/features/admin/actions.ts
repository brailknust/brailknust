"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/features/auth/queries";
import { removeCourseMaterialFile } from "@/features/materials/storage";
import { finalizeAccountDeletionCleanup } from "@/features/profile/account-deletion";
import { prisma } from "@/server/db";
import { z } from "zod";
import { curriculumTermSlots, ensureProgrammeCurriculum } from "@/features/academics/curriculum-provisioning";
import { parseCurriculumCsv } from "@/features/admin/curriculum-import";
import { createAdminContentAudit } from "@/features/admin/audit";
import { knustCurricula } from "@/data/curricula";

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
const correctionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["SUBMITTED", "IN_REVIEW", "RESOLVED", "REJECTED"]),
  resolutionNote: z.string().trim().max(2000).optional(),
});
const bulkCatalogSchema = z.object({
  operation: z.enum(["APPROVE", "REJECT", "DELETE_ORPHANS"]),
  courseIds: z.array(z.string().uuid()).min(1).max(100),
});
const curriculumImportSchema = z.object({
  college: z.string().trim().min(2).max(200),
  department: z.string().trim().min(2).max(200),
  programme: z.string().trim().min(2).max(200),
  version: z.string().trim().min(2).max(32),
  durationYears: z.coerce.number().int().min(1).max(6),
  termsPerYear: z.coerce.number().int().min(1).max(2),
  source: z.string().trim().max(500).optional(),
  csv: z.string().max(250_000),
});

export async function previewCurriculumImport(formData: FormData) {
  const { appUser } = await requireAdmin();
  const parsed = curriculumImportSchema.parse({
    college: formData.get("college"), department: formData.get("department"), programme: formData.get("programme"),
    version: formData.get("version"), durationYears: formData.get("durationYears"), termsPerYear: formData.get("termsPerYear"),
    source: formData.get("source") || undefined, csv: formData.get("csv"),
  });
  const rows = parseCurriculumCsv(parsed.csv);
  const duplicateVersion = await prisma.programmeCurriculum.findUnique({
    where: { college_programme_version: { college: parsed.college, programme: parsed.programme, version: parsed.version } },
    select: { id: true },
  });
  const importRecord = await prisma.curriculumImport.create({
    data: {
      createdById: appUser.id,
      college: parsed.college,
      department: parsed.department,
      programme: parsed.programme,
      version: parsed.version,
      durationYears: parsed.durationYears,
      termsPerYear: parsed.termsPerYear,
      source: parsed.source,
      rows: {
        create: rows.map((row) => ({
          ...row,
          status: row.error || duplicateVersion ? "INVALID" : "VALID",
          error: duplicateVersion ? "This curriculum version already exists." : row.error,
        })),
      },
    },
  });
  redirect(`/admin/catalog?import=${importRecord.id}`);
}

export async function applyCurriculumImport(formData: FormData) {
  const { appUser } = await requireAdmin();
  const importId = z.string().uuid().parse(formData.get("importId"));
  await prisma.$transaction(async (tx) => {
    const importRecord = await tx.curriculumImport.findUnique({ where: { id: importId }, include: { rows: true } });
    if (!importRecord || importRecord.status !== "DRAFT") throw new Error("This curriculum preview is no longer available to apply.");
    if (!importRecord.rows.length || importRecord.rows.some((row) => row.status !== "VALID")) throw new Error("Fix every invalid import row before applying this curriculum.");
    const slots = curriculumTermSlots(importRecord.durationYears, importRecord.termsPerYear);
    const validSlotKeys = new Set(slots.map((slot) => `${slot.level}:${slot.term}`));
    if (importRecord.rows.some((row) => !row.level || !row.term || !validSlotKeys.has(`${row.level}:${row.term}`))) {
      throw new Error("Every course must fit within the selected duration and terms per year.");
    }
    const existing = await tx.programmeCurriculum.findUnique({
      where: { college_programme_version: { college: importRecord.college, programme: importRecord.programme, version: importRecord.version } }, select: { id: true },
    });
    if (existing) throw new Error("A curriculum with this college, programme, and version already exists.");
    const curriculum = await tx.programmeCurriculum.create({
      data: {
        college: importRecord.college, department: importRecord.department, programme: importRecord.programme,
        version: importRecord.version, durationYears: importRecord.durationYears, termsPerYear: importRecord.termsPerYear,
        source: importRecord.source, isPublished: true,
      },
    });
    for (const slot of slots) {
      const term = await tx.programmeCurriculumTerm.create({
        data: { curriculumId: curriculum.id, level: slot.level, term: slot.term, name: slot.name, source: importRecord.source },
      });
      const courses = importRecord.rows.filter((row) => row.level === slot.level && row.term === slot.term);
      if (courses.length) await tx.programmeCurriculumCourse.createMany({
        data: courses.map((row) => ({
          curriculumTermId: term.id,
          courseCode: row.courseCode!,
          courseName: row.courseName!,
          creditHours: row.creditHours!,
          courseKind: row.courseKind,
          electiveGroup: row.electiveGroup,
          replacesCourseCode: row.replacesCourseCode,
          isApproved: true,
          source: importRecord.source,
        })),
      });
    }
    await tx.curriculumImport.update({ where: { id: importRecord.id }, data: { status: "APPLIED", curriculumId: curriculum.id, appliedAt: new Date() } });
    await tx.curriculumImportRow.updateMany({ where: { importId: importRecord.id }, data: { status: "APPLIED" } });
    await createAdminContentAudit(tx, {
      actorId: appUser.id, action: "CURRICULUM_IMPORT_APPLIED", targetType: "CATALOG",
      targetId: curriculum.id, targetLabel: `${importRecord.programme} ${importRecord.version}`,
      metadata: {
        importId: importRecord.id,
        version: importRecord.version,
        rowCount: importRecord.rows.length,
        electiveCount: importRecord.rows.filter((row) => row.courseKind === "ELECTIVE").length,
        renamedCodeCount: importRecord.rows.filter((row) => row.replacesCourseCode).length,
      },
    });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/onboarding");
}

export async function rollbackCurriculumImport(formData: FormData) {
  const { appUser } = await requireAdmin();
  const importId = z.string().uuid().parse(formData.get("importId"));
  await prisma.$transaction(async (tx) => {
    const importRecord = await tx.curriculumImport.findUnique({ where: { id: importId }, select: { id: true, status: true, curriculumId: true, programme: true, version: true } });
    if (!importRecord || importRecord.status !== "APPLIED" || !importRecord.curriculumId) throw new Error("Only an applied curriculum import can be rolled back.");
    const semesterCount = await tx.semester.count({ where: { curriculumId: importRecord.curriculumId } });
    if (semesterCount) throw new Error("This curriculum is already assigned to student semesters and cannot be rolled back.");
    await tx.programmeCurriculum.delete({ where: { id: importRecord.curriculumId } });
    await tx.curriculumImport.update({ where: { id: importRecord.id }, data: { status: "ROLLED_BACK", rolledBackAt: new Date() } });
    await createAdminContentAudit(tx, {
      actorId: appUser.id, action: "CURRICULUM_IMPORT_ROLLED_BACK", targetType: "CATALOG",
      targetId: importRecord.curriculumId, targetLabel: `${importRecord.programme} ${importRecord.version}`,
      metadata: { importId: importRecord.id, version: importRecord.version },
    });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/onboarding");
}

export async function syncBundledCurricula() {
  const { appUser } = await requireAdmin();
  const definitions = [...new Map(knustCurricula.map((template) => [
    `${template.college}|${template.department}|${template.program}|${template.version}`,
    template,
  ])).values()];
  const curricula: Array<{ id: string }> = [];
  for (const definition of definitions) {
    curricula.push(await ensureProgrammeCurriculum({
      college: definition.college,
      department: definition.department,
      programme: definition.program,
      version: definition.version,
    }));
  }
  await prisma.$transaction(async (tx) => {
    await createAdminContentAudit(tx, {
      actorId: appUser.id,
      action: "BUNDLED_CURRICULA_SYNCED",
      targetType: "CATALOG",
      targetId: curricula.map((curriculum) => curriculum.id).join(","),
      targetLabel: `${definitions.length} bundled curriculum version${definitions.length === 1 ? "" : "s"}`,
      metadata: { programmeVersionCount: definitions.length, termCount: knustCurricula.length, courseCount: knustCurricula.reduce((sum, template) => sum + template.courses.length, 0) },
    });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/onboarding");
}

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

export async function updateContentCorrectionStatus(formData: FormData) {
  const { appUser } = await requireAdmin();
  const parsed = correctionStatusSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
    resolutionNote: formData.get("resolutionNote") || undefined,
  });
  if (["RESOLVED", "REJECTED"].includes(parsed.status) && !parsed.resolutionNote) {
    throw new Error("Add a resolution note before closing a correction request.");
  }
  await prisma.contentCorrectionRequest.update({
    where: { id: parsed.id },
    data: {
      status: parsed.status,
      resolutionNote: parsed.resolutionNote ?? null,
      reviewedById: appUser.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/admin/feedback");
}

export async function approveStudentCourse(formData: FormData) {
  const { appUser } = await requireAdmin();
  const { courseId } = courseApprovalSchema.parse({ courseId: formData.get("courseId") });
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.findFirst({ where: { id: courseId, approvalStatus: { in: ["PENDING", "REJECTED"] } }, select: { id: true, code: true, name: true, approvalStatus: true } });
    if (!course) return;
    await tx.course.update({ where: { id: course.id }, data: { approvalStatus: "OFFICIAL", createdById: null } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "COURSE_APPROVED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}`, metadata: { previousStatus: course.approvalStatus } });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/academics");
}

export async function rejectStudentCourse(formData: FormData) {
  const { appUser } = await requireAdmin();
  const { courseId } = courseApprovalSchema.parse({ courseId: formData.get("courseId") });
  await prisma.$transaction(async (tx) => {
    const course = await tx.course.findFirst({ where: { id: courseId, approvalStatus: "PENDING", createdById: { not: null } }, select: { id: true, code: true, name: true } });
    if (!course) return;
    await tx.course.update({ where: { id: course.id }, data: { approvalStatus: "REJECTED" } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "COURSE_REJECTED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}` });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/academics");
}

export async function bulkCatalogCourses(formData: FormData) {
  const { appUser } = await requireAdmin();
  const parsed = bulkCatalogSchema.parse({
    operation: formData.get("operation"),
    courseIds: [...new Set(formData.getAll("courseIds").map(String))],
  });
  await prisma.$transaction(async (tx) => {
    const courses = await tx.course.findMany({
      where: { id: { in: parsed.courseIds } },
      select: {
        id: true, code: true, name: true, approvalStatus: true, createdById: true,
        _count: { select: { enrollments: true, assessments: true, goals: true, groups: true, resources: true, studyItems: true, tasks: true, timetable: true, weakAreas: true, peerQuestions: true, platformMaterials: true, platformTopics: true } },
      },
    });
    for (const course of courses) {
      if (parsed.operation === "APPROVE" && course.approvalStatus !== "OFFICIAL") {
        await tx.course.update({ where: { id: course.id }, data: { approvalStatus: "OFFICIAL", createdById: null } });
        await createAdminContentAudit(tx, { actorId: appUser.id, action: "COURSE_APPROVED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}`, metadata: { bulk: true, previousStatus: course.approvalStatus } });
      } else if (parsed.operation === "REJECT" && course.approvalStatus === "PENDING" && course.createdById) {
        await tx.course.update({ where: { id: course.id }, data: { approvalStatus: "REJECTED" } });
        await createAdminContentAudit(tx, { actorId: appUser.id, action: "COURSE_REJECTED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}`, metadata: { bulk: true } });
      } else if (parsed.operation === "DELETE_ORPHANS") {
        const references = Object.values(course._count).reduce((total, count) => total + count, 0);
        if (references === 0) {
          await tx.course.delete({ where: { id: course.id } });
          await createAdminContentAudit(tx, { actorId: appUser.id, action: "ORPHAN_COURSE_DELETED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}`, metadata: { bulk: true } });
        }
      }
    }
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/content");
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
  const { appUser } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const material = await prisma.platformCourseMaterial.findUnique({
    where: { id },
    select: { id: true, storagePath: true, courseId: true, title: true },
  });
  if (!material) return;
  if (material.storagePath) await removeCourseMaterialFile(material.storagePath);
  await prisma.$transaction(async (tx) => {
    await tx.platformCourseMaterial.delete({ where: { id: material.id } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "MATERIAL_DELETED", targetType: "MATERIAL", targetId: material.id, targetLabel: material.title, metadata: { courseId: material.courseId, hadStoredFile: Boolean(material.storagePath) } });
  });
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
  await prisma.$transaction(async (tx) => {
    await tx.programmeCourseExclusion.upsert({
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
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "PROGRAMME_COURSE_EXCLUDED", targetType: "CATALOG", targetId: `${parsed.programme}|${parsed.level}|${parsed.semester}|${parsed.courseCode}`, targetLabel: parsed.courseCode, metadata: { programme: parsed.programme, level: parsed.level, semester: parsed.semester } });
  });
  revalidatePath("/admin/catalog");
}

export async function restoreProgrammeCourse(formData: FormData) {
  const { appUser } = await requireAdmin();
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
  await prisma.$transaction(async (tx) => {
    const result = await tx.programmeCourseExclusion.deleteMany({ where: parsed });
    if (result.count) await createAdminContentAudit(tx, { actorId: appUser.id, action: "PROGRAMME_COURSE_RESTORED", targetType: "CATALOG", targetId: `${parsed.programme}|${parsed.level}|${parsed.semester}|${parsed.courseCode}`, targetLabel: parsed.courseCode, metadata: { programme: parsed.programme, level: parsed.level, semester: parsed.semester } });
  });
  revalidatePath("/admin/catalog");
}

export async function deleteOrphanCatalogCourse(formData: FormData) {
  const { appUser } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("courseId"));
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
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
  await prisma.$transaction(async (tx) => {
    await tx.course.delete({ where: { id: course.id } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "ORPHAN_COURSE_DELETED", targetType: "CATALOG", targetId: course.id, targetLabel: `${course.code} - ${course.name}` });
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/content");
}

export async function createPlatformTopic(formData: FormData) {
  const { appUser } = await requireAdmin();
  const parsed = topicSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    learningOutcomes: formData.get("learningOutcomes") || undefined,
    sequence: formData.get("sequence") || 0,
  });
  if (!parsed.success) throw new Error("Check the topic details.");
  await prisma.$transaction(async (tx) => {
    const topic = await tx.platformCourseTopic.create({ data: parsed.data });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "TOPIC_CREATED", targetType: "TOPIC", targetId: topic.id, targetLabel: topic.title, metadata: { courseId: topic.courseId, sequence: topic.sequence } });
  });
  revalidatePath(`/admin/content/${parsed.data.courseId}/topics`);
}

export async function updatePlatformTopic(formData: FormData) {
  const { appUser } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const parsed = topicSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    learningOutcomes: formData.get("learningOutcomes") || undefined,
    sequence: formData.get("sequence") || 0,
  });
  if (!parsed.success) throw new Error("Check the topic details.");
  await prisma.$transaction(async (tx) => {
    const previous = await tx.platformCourseTopic.findUnique({ where: { id }, select: { title: true, description: true, learningOutcomes: true, sequence: true, courseId: true } });
    if (!previous || previous.courseId !== parsed.data.courseId) throw new Error("Topic not found.");
    await tx.platformCourseTopic.update({ where: { id }, data: { title: parsed.data.title, description: parsed.data.description ?? null, learningOutcomes: parsed.data.learningOutcomes ?? null, sequence: parsed.data.sequence } });
    const changedFields = (["title", "description", "learningOutcomes", "sequence"] as const).filter((field) => (previous[field] ?? null) !== (parsed.data[field] ?? null));
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "TOPIC_UPDATED", targetType: "TOPIC", targetId: id, targetLabel: parsed.data.title, metadata: { courseId: parsed.data.courseId, changedFields } });
  });
  revalidatePath(`/admin/content/${parsed.data.courseId}/topics`);
  revalidatePath("/practice");
}

export async function togglePlatformTopicArchive(formData: FormData) {
  const { appUser } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const isArchived = formData.get("isArchived") === "true";
  await prisma.$transaction(async (tx) => {
    const topic = await tx.platformCourseTopic.update({ where: { id, courseId }, data: { isArchived: !isArchived } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: topic.isArchived ? "TOPIC_ARCHIVED" : "TOPIC_RESTORED", targetType: "TOPIC", targetId: topic.id, targetLabel: topic.title, metadata: { courseId } });
  });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/practice");
}

export async function deletePlatformTopic(formData: FormData) {
  const { appUser } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const topic = await prisma.platformCourseTopic.findFirst({
    where: { id, courseId },
    select: {
      id: true,
      title: true,
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
  await prisma.$transaction(async (tx) => {
    await tx.platformCourseTopic.delete({ where: { id: topic.id } });
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "TOPIC_DELETED", targetType: "TOPIC", targetId: topic.id, targetLabel: topic.title, metadata: { courseId } });
  });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/admin/content");
  revalidatePath("/practice");
}

export async function mergePlatformTopics(formData: FormData) {
  const { appUser } = await requireAdmin();
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const sourceId = z.string().uuid().parse(formData.get("sourceId"));
  const targetId = z.string().uuid().parse(formData.get("targetId"));
  if (sourceId === targetId) throw new Error("Choose a different destination topic.");

  await prisma.$transaction(async (tx) => {
    const topics = await tx.platformCourseTopic.findMany({
      where: { id: { in: [sourceId, targetId] }, courseId },
      select: { id: true, title: true },
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
    const source = topics.find((topic) => topic.id === sourceId)!;
    const target = topics.find((topic) => topic.id === targetId)!;
    await createAdminContentAudit(tx, { actorId: appUser.id, action: "TOPICS_MERGED", targetType: "TOPIC", targetId: sourceId, targetLabel: source.title, metadata: { courseId, destinationTopicId: targetId, destinationTopicTitle: target.title } });
  });
  revalidatePath(`/admin/content/${courseId}/topics`);
  revalidatePath("/practice");
}
