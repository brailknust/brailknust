import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    semester: { findFirst: vi.fn() },
    course: { findFirst: vi.fn() },
    programmeCurriculumCourse: { findUnique: vi.fn() },
    studentCourseExclusion: { deleteMany: vi.fn() },
    enrollment: { upsert: vi.fn() },
    semesterProfile: { upsert: vi.fn() },
  },
}));

vi.mock("@/features/auth/queries", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createEnrollment } from "@/features/academics/actions";

const userId = "00000000-0000-4000-8000-000000000001";
const semesterId = "00000000-0000-4000-8000-000000000002";
const termId = "00000000-0000-4000-8000-000000000003";
const courseId = "00000000-0000-4000-8000-000000000004";

function form() {
  const data = new FormData();
  data.set("semesterId", semesterId);
  data.set("courseId", courseId);
  return data;
}

describe("curriculum enrollment rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({ appUser: { id: userId } });
    mocks.prisma.semester.findFirst.mockResolvedValue({ id: semesterId, isArchived: false, curriculumTermId: termId });
    mocks.prisma.course.findFirst.mockResolvedValue({ id: courseId, code: "COE 481" });
    mocks.prisma.studentCourseExclusion.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.enrollment.upsert.mockResolvedValue({ id: "enrollment" });
    mocks.prisma.semesterProfile.upsert.mockResolvedValue({ id: "profile" });
  });

  it("records an explicit curriculum elective selection", async () => {
    mocks.prisma.programmeCurriculumCourse.findUnique.mockResolvedValue({ courseKind: "ELECTIVE", replacesCourseCode: null });
    await createEnrollment(form());
    expect(mocks.prisma.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ origin: "CURRICULUM_ELECTIVE", sourceKey: `curriculum-course:${termId}:COE 481` }),
    }));
  });

  it("clears current and predecessor exclusions when a core course is re-added", async () => {
    mocks.prisma.course.findFirst.mockResolvedValue({ id: courseId, code: "COE 181" });
    mocks.prisma.programmeCurriculumCourse.findUnique.mockResolvedValue({ courseKind: "CORE", replacesCourseCode: "EE 151" });
    await createEnrollment(form());
    expect(mocks.prisma.studentCourseExclusion.deleteMany).toHaveBeenCalledWith({ where: { userId, semesterId, courseCode: { in: ["COE 181", "EE 151"] } } });
    expect(mocks.prisma.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ origin: "CURRICULUM_DEFAULT" }) }));
  });
});
