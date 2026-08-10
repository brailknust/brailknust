import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  moveCourseMaterialFile: vi.fn(),
  removeCourseMaterialFile: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    platformCourseMaterial: { findUnique: vi.fn(), update: vi.fn() },
    platformCourseTopic: { findMany: vi.fn() },
    platformMaterialTopic: { deleteMany: vi.fn(), createMany: vi.fn() },
    platformMaterialChunk: { updateMany: vi.fn() },
    adminContentAudit: { create: vi.fn() },
  },
}));

vi.mock("@/features/auth/queries", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/materials/storage", () => ({
  moveCourseMaterialFile: mocks.moveCourseMaterialFile,
  removeCourseMaterialFile: mocks.removeCourseMaterialFile,
}));

import { reassignPlatformMaterial } from "@/features/admin/actions";

const actorId = "00000000-0000-4000-8000-000000000001";
const materialId = "00000000-0000-4000-8000-000000000010";
const sourceCourseId = "00000000-0000-4000-8000-000000000020";
const targetCourseId = "00000000-0000-4000-8000-000000000021";
const sourceTopicId = "00000000-0000-4000-8000-000000000040";
const targetTopicId = "00000000-0000-4000-8000-000000000030";
const foreignTopicId = "00000000-0000-4000-8000-000000000099";
const sourcePath = `platform/${sourceCourseId}/${materialId}/notes.pdf`;
const targetPath = `platform/${targetCourseId}/${materialId}/notes.pdf`;

function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.set(key, value);
  }
  return data;
}

function baseMaterial(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: materialId,
    courseId: sourceCourseId,
    topicId: sourceTopicId,
    title: "Lecture notes",
    contentHash: "hash-1",
    storagePath: sourcePath,
    mimeType: "application/pdf",
    ...overrides,
  };
}

describe("reassignPlatformMaterial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ appUser: { id: actorId } });
    mocks.moveCourseMaterialFile.mockResolvedValue(undefined);
    mocks.removeCourseMaterialFile.mockResolvedValue(undefined);
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: typeof mocks.prisma) => unknown) => fn(mocks.prisma));
    mocks.prisma.platformCourseTopic.findMany.mockResolvedValue([{ id: targetTopicId }]);
    mocks.prisma.platformCourseMaterial.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) return baseMaterial();
      return null;
    });
  });

  it("moves a material to a different course and topic, and moves its storage object", async () => {
    await reassignPlatformMaterial(form({ materialId, targetCourseId, targetTopicIds: [targetTopicId] }));

    expect(mocks.moveCourseMaterialFile).toHaveBeenCalledWith(sourcePath, targetPath, "application/pdf");
    expect(mocks.prisma.platformCourseMaterial.update).toHaveBeenCalledWith({
      where: { id: materialId },
      data: { courseId: targetCourseId, topicId: targetTopicId, storagePath: targetPath },
    });
    expect(mocks.prisma.platformMaterialTopic.deleteMany).toHaveBeenCalledWith({ where: { materialId } });
    expect(mocks.prisma.platformMaterialTopic.createMany).toHaveBeenCalledWith({
      data: [{ materialId, topicId: targetTopicId }],
      skipDuplicates: true,
    });
    expect(mocks.prisma.platformMaterialChunk.updateMany).toHaveBeenCalledWith({
      where: { materialId },
      data: { topicId: targetTopicId },
    });
    expect(mocks.prisma.adminContentAudit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId,
        action: "MATERIAL_REASSIGNED",
        targetType: "MATERIAL",
        targetId: materialId,
      }),
    }));
    // the old storage object is only removed after the DB is already pointing at the new path
    expect(mocks.removeCourseMaterialFile).toHaveBeenCalledWith(sourcePath);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/content/${sourceCourseId}/topics`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/content/${targetCourseId}/topics`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/content");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/practice");
  });

  it("rejects a target topic that does not belong to the destination course", async () => {
    mocks.prisma.platformCourseTopic.findMany.mockResolvedValue([]);
    await expect(reassignPlatformMaterial(form({ materialId, targetCourseId, targetTopicIds: [foreignTopicId] })))
      .rejects.toThrow("Choose topics that belong to the destination course.");
    expect(mocks.prisma.platformCourseMaterial.update).not.toHaveBeenCalled();
    expect(mocks.moveCourseMaterialFile).not.toHaveBeenCalled();
  });

  it("blocks a cross-course move when the destination already has identical content", async () => {
    mocks.prisma.platformCourseMaterial.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) return baseMaterial();
      if (where.courseId_contentHash) return { id: "existing-material", title: "Duplicate notes" };
      return null;
    });
    await expect(reassignPlatformMaterial(form({ materialId, targetCourseId, targetTopicIds: [targetTopicId] })))
      .rejects.toThrow(/already exists in the destination course/);
    expect(mocks.moveCourseMaterialFile).not.toHaveBeenCalled();
    expect(mocks.prisma.platformCourseMaterial.update).not.toHaveBeenCalled();
  });

  it("does not touch storage or the destination path twice when reassigning within the same course", async () => {
    mocks.prisma.platformCourseMaterial.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) return baseMaterial({ courseId: targetCourseId });
      return null;
    });
    await reassignPlatformMaterial(form({ materialId, targetCourseId, targetTopicIds: [targetTopicId] }));

    expect(mocks.moveCourseMaterialFile).not.toHaveBeenCalled();
    expect(mocks.removeCourseMaterialFile).not.toHaveBeenCalled();
    expect(mocks.prisma.platformCourseMaterial.update).toHaveBeenCalledWith({
      where: { id: materialId },
      data: { courseId: targetCourseId, topicId: targetTopicId, storagePath: sourcePath },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });
});
