import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enrollment: vi.fn(),
  privateChunks: vi.fn(),
  platformChunks: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    enrollment: { findFirst: mocks.enrollment },
    materialChunk: { findMany: mocks.privateChunks },
    platformMaterialChunk: { findMany: mocks.platformChunks },
  },
}));

import { retrieveCourseMaterialContext } from "@/features/materials/retrieval";

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  semester: "00000000-0000-4000-8000-000000000002",
  enrollment: "00000000-0000-4000-8000-000000000003",
  course: "00000000-0000-4000-8000-000000000004",
};

function chunk(source: "platform" | "private", content: string, index: number) {
  return {
    id: `${source}-${index}`,
    chunkIndex: index,
    content,
    ...(source === "private" ? { pageLabel: `p${index + 1}` } : {}),
    topic: { title: "Queues" },
    material: {
      id: `${source}-material`,
      title: `${source} notes`,
      type: "NOTE",
      sourceUrl: null,
    },
  };
}

describe("course material retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enrollment.mockResolvedValue({ courseId: ids.course });
  });

  it("checks ownership before querying and ranks platform evidence first", async () => {
    mocks.platformChunks.mockResolvedValue([chunk("platform", "queue operations and complexity", 1)]);
    mocks.privateChunks.mockResolvedValue([chunk("private", "queue operations and examples", 0)]);

    const result = await retrieveCourseMaterialContext(
      ids.user,
      ids.semester,
      ids.enrollment,
      "Explain queue operations",
    );

    expect(mocks.enrollment).toHaveBeenCalledWith({
      where: { id: ids.enrollment, userId: ids.user, semesterId: ids.semester },
      select: { courseId: true },
    });
    expect(result.passages).toHaveLength(2);
    expect(result.passages[0]).toMatchObject({ reference: "S1", sourceType: "PLATFORM" });
    expect(result.sources[1]).toMatchObject({ reference: "S2", sourceType: "PRIVATE" });
  });

  it("returns no material for a foreign enrollment or stop-word-only query", async () => {
    mocks.enrollment.mockResolvedValue(null);
    await expect(retrieveCourseMaterialContext(ids.user, ids.semester, ids.enrollment, "queues")).resolves.toEqual({ passages: [], sources: [] });
    await expect(retrieveCourseMaterialContext(ids.user, ids.semester, ids.enrollment, "please explain this")).resolves.toEqual({ passages: [], sources: [] });
    expect(mocks.privateChunks).not.toHaveBeenCalled();
  });
});
