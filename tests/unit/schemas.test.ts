import { describe, expect, it } from "vitest";

import { semesterProfileSchema } from "@/features/academics/schemas";
import { assessmentSchema } from "@/features/assessments/schemas";
import { generatedQuestionSetSchema } from "@/features/diagnostics/schemas";
import { createStudyPlanItemSchema } from "@/features/planner/schemas";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("business input schemas", () => {
  it("bounds CWA and assessment scores", () => {
    expect(semesterProfileSchema.safeParse({ semesterId: uuid, cwa: 100 }).success).toBe(true);
    expect(semesterProfileSchema.safeParse({ semesterId: uuid, cwa: 100.1 }).success).toBe(false);
    expect(assessmentSchema.safeParse({
      semesterId: uuid,
      courseId: uuid,
      title: "Quiz one",
      type: "QUIZ",
      score: 21,
      maxScore: 20,
    }).success).toBe(false);
  });

  it("rejects study sessions whose end is not after the start", () => {
    expect(createStudyPlanItemSchema.safeParse({
      studyPlanId: uuid,
      title: "Revision",
      dayOfWeek: 1,
      startTime: "12:00",
      endTime: "11:30",
    }).success).toBe(false);
  });

  it("requires valid, four-option diagnostic questions", () => {
    const validQuestion = {
      prompt: "Which structure provides first-in first-out access?",
      options: ["Queue", "Stack", "Tree", "Graph"],
      correctAnswer: "A",
      explanation: "A queue removes items in insertion order.",
      difficulty: "EASY",
      sourceRefs: ["S1"],
    };

    expect(generatedQuestionSetSchema.safeParse({ questions: Array.from({ length: 4 }, () => validQuestion) }).success).toBe(true);
    expect(generatedQuestionSetSchema.safeParse({
      questions: Array.from({ length: 4 }, () => ({ ...validQuestion, options: ["Queue", "Stack"] })),
    }).success).toBe(false);
  });
});
