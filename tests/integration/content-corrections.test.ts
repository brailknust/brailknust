import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    enrollment: { findFirst: vi.fn() },
    platformCourseTopic: { findFirst: vi.fn() },
    platformCourseMaterial: { findFirst: vi.fn() },
    contentCorrectionRequest: { create: vi.fn() },
  },
}));

vi.mock("@/features/auth/queries", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { submitContentCorrection } from "@/features/corrections/actions";

const userId = "00000000-0000-4000-8000-000000000001";
const semesterId = "00000000-0000-4000-8000-000000000002";
const courseId = "00000000-0000-4000-8000-000000000003";
const topicId = "00000000-0000-4000-8000-000000000004";
const materialId = "00000000-0000-4000-8000-000000000005";

function form(target: string) {
  const data = new FormData();
  data.set("semesterId", semesterId);
  data.set("courseId", courseId);
  data.set("target", target);
  data.set("details", "The stated formula should use the corrected denominator.");
  return data;
}

describe("student content corrections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId } });
    mocks.prisma.enrollment.findFirst.mockResolvedValue({ id: "enrollment" });
    mocks.prisma.contentCorrectionRequest.create.mockResolvedValue({ id: "request" });
  });

  it("creates a correction only after confirming course enrollment", async () => {
    await submitContentCorrection(form(`COURSE:${courseId}`));
    expect(mocks.prisma.enrollment.findFirst).toHaveBeenCalledWith({ where: { userId, semesterId, courseId }, select: { id: true } });
    expect(mocks.prisma.contentCorrectionRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId, courseId, targetType: "COURSE", topicId: null, materialId: null }) });
  });

  it("accepts only an active topic from the enrolled course", async () => {
    mocks.prisma.platformCourseTopic.findFirst.mockResolvedValue({ id: topicId });
    await submitContentCorrection(form(`TOPIC:${topicId}`));
    expect(mocks.prisma.platformCourseTopic.findFirst).toHaveBeenCalledWith({ where: { id: topicId, courseId, isArchived: false }, select: { id: true } });
    expect(mocks.prisma.contentCorrectionRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ targetType: "TOPIC", topicId }) });
  });

  it("retains a material's primary topic for administrator context", async () => {
    mocks.prisma.platformCourseMaterial.findFirst.mockResolvedValue({ id: materialId, topicId });
    await submitContentCorrection(form(`MATERIAL:${materialId}`));
    expect(mocks.prisma.contentCorrectionRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ targetType: "MATERIAL", materialId, topicId }) });
  });
});
