import { beforeEach, describe, expect, it, vi } from "vitest";

const createChatCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/features/ai/provider", () => ({ createChatCompletion }));

import {
  classifyCourseMessage,
  courseScopeRefusal,
} from "@/features/ai/course-scope";

const scope = {
  code: "COE 201",
  name: "Data Structures",
  description: "Data organization and algorithms",
  otherEnrolledCourses: [{ code: "MATH 251", name: "Linear Algebra" }],
};

describe("AI course scope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks only confident out-of-scope classifications", async () => {
    createChatCompletion.mockResolvedValue('{"decision":"OUT_OF_SCOPE","confidence":0.94,"reason":"another course"}');
    await expect(classifyCourseMessage("Solve this matrix", scope)).resolves.toMatchObject({
      decision: "OUT_OF_SCOPE",
      blocked: true,
    });

    createChatCompletion.mockResolvedValue('{"decision":"AMBIGUOUS","confidence":0.6}');
    await expect(classifyCourseMessage("Can you explain that?", scope)).resolves.toMatchObject({
      decision: "AMBIGUOUS",
      blocked: false,
    });
  });

  it("returns a selected-course redirect message", () => {
    expect(courseScopeRefusal(scope)).toContain("COE 201 - Data Structures");
  });
});
