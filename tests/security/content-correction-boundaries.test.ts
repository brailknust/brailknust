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
const foreignId = "00000000-0000-4000-8000-000000000099";

function form(target: string) {
  const data = new FormData();
  data.set("semesterId", semesterId); data.set("courseId", courseId); data.set("target", target);
  data.set("details", "This correction has enough detail to be reviewed safely.");
  return data;
}

describe("content-correction authorization boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId } });
  });

  it("rejects a request for a course outside the student's semester", async () => {
    mocks.prisma.enrollment.findFirst.mockResolvedValue(null);
    await expect(submitContentCorrection(form(`COURSE:${courseId}`))).rejects.toThrow("not part of your semester");
    expect(mocks.prisma.contentCorrectionRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a topic id that does not belong to the selected course", async () => {
    mocks.prisma.enrollment.findFirst.mockResolvedValue({ id: "enrollment" });
    mocks.prisma.platformCourseTopic.findFirst.mockResolvedValue(null);
    await expect(submitContentCorrection(form(`TOPIC:${foreignId}`))).rejects.toThrow("not available for this course");
    expect(mocks.prisma.contentCorrectionRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a material id that is foreign or unpublished", async () => {
    mocks.prisma.enrollment.findFirst.mockResolvedValue({ id: "enrollment" });
    mocks.prisma.platformCourseMaterial.findFirst.mockResolvedValue(null);
    await expect(submitContentCorrection(form(`MATERIAL:${foreignId}`))).rejects.toThrow("not available for this course");
    expect(mocks.prisma.contentCorrectionRequest.create).not.toHaveBeenCalled();
  });
});
