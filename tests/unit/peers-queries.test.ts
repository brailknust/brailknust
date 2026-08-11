import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  semesterFindMany: vi.fn(),
  semesterProfileFindUnique: vi.fn(),
  enrollmentFindMany: vi.fn(),
  studyGroupFindMany: vi.fn(),
  weakAreaFindMany: vi.fn(),
  userFindMany: vi.fn(),
  peerQuestionFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findMany: mocks.userFindMany },
    semester: { findMany: mocks.semesterFindMany },
    semesterProfile: { findUnique: mocks.semesterProfileFindUnique },
    enrollment: { findMany: mocks.enrollmentFindMany },
    studyGroup: { findMany: mocks.studyGroupFindMany },
    weakArea: { findMany: mocks.weakAreaFindMany },
    peerQuestion: { findMany: mocks.peerQuestionFindMany },
  },
}));

import { getPeersPageData } from "@/features/peers/queries";

describe("getPeersPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userFindUnique.mockResolvedValue({
      activeSemesterId: "semester-1",
      activeSemester: {
        academicYear: "2026/2027",
        level: "LEVEL_300",
        term: "FIRST",
      },
      programme: "Computer Engineering",
    });
    mocks.semesterFindMany.mockResolvedValue([{ id: "semester-1" }]);
    mocks.semesterProfileFindUnique.mockResolvedValue({ level: "LEVEL_300" });
    mocks.enrollmentFindMany.mockResolvedValue([
      { courseId: "course-1", course: { id: "course-1", code: "COE 311", name: "Algorithms Analysis" } },
    ]);
    mocks.studyGroupFindMany.mockResolvedValue([]);
    mocks.weakAreaFindMany.mockResolvedValue([
      { topic: "algorithm analysis", courseId: "course-1" },
    ]);
    mocks.userFindMany.mockResolvedValue([
      {
        id: "peer-1",
        fullName: "Peer Student",
        avatarUrl: null,
        programme: "Computer Engineering",
        activeSemester: { level: "LEVEL_300" },
        topicMasteries: [
          {
            masteryScore: { toNumber: () => 90 },
            topic: { title: "Algorithm Analysis" },
          },
        ],
      },
    ]);
    mocks.peerQuestionFindMany.mockResolvedValue([]);
  });

  it("returns peers when mastery matches the weak area course even if topic casing differs", async () => {
    const result = await getPeersPageData("user-1");

    expect(result.peers).toHaveLength(1);
    expect(result.peers[0]).toMatchObject({
      id: "peer-1",
      fullName: "Peer Student",
      strengthScore: 90,
      matchedTopics: ["Algorithm Analysis"],
    });
  });
});
