import { describe, expect, it } from "vitest";

import { semesterProfileSchema } from "@/features/academics/schemas";
import { calculateAssessmentAverage } from "@/features/academics/calculations";
import { assessmentSchema } from "@/features/assessments/schemas";
import { generatedQuestionSetSchema } from "@/features/diagnostics/schemas";
import { feedbackSchema } from "@/features/feedback/schemas";
import { createStudyPlanItemSchema, plannerPreferencesSchema } from "@/features/planner/schemas";
import { supportRequestSchema } from "@/features/support/schemas";

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

  it("calculates weighted assessment averages and ignores invalid results", () => {
    expect(calculateAssessmentAverage([
      { score: 18, maxScore: 20, weight: 20 },
      { score: 40, maxScore: 50, weight: 80 },
    ])).toBe(82);
    expect(calculateAssessmentAverage([
      { score: 18, maxScore: 20 },
      { score: 40, maxScore: 50 },
      { score: 60, maxScore: 0 },
    ])).toBe(85);
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

  it("rejects invalid academic dates and reminder order", async () => {
    const { createTaskSchema } = await import("@/features/tasks/schemas");
    const { createStudyPlanSchema } = await import("@/features/planner/schemas");

    expect(createTaskSchema.safeParse({ title: "Submit work", dueAt: "not-a-date" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "Submit work", dueAt: "2026-08-10T12:00", reminderAt: "2026-08-10T13:00" }).success).toBe(false);
    expect(createStudyPlanSchema.safeParse({ title: "Week plan", startDate: "2026-08-10", endDate: "2026-08-09" }).success).toBe(false);
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

  it("rejects malformed or impossible study-plan generation preferences", () => {
    const valid = { sessionLength: 60, preferredStart: "08:00", preferredEnd: "21:00", intensity: "balanced" };
    expect(plannerPreferencesSchema.safeParse(valid).success).toBe(true);
    // Garbled/missing time strings must not silently reach the generator.
    expect(plannerPreferencesSchema.safeParse({ ...valid, preferredStart: "not-a-time" }).success).toBe(false);
    expect(plannerPreferencesSchema.safeParse({ ...valid, preferredStart: "" }).success).toBe(false);
    // An inverted window (end before start).
    expect(plannerPreferencesSchema.safeParse({ ...valid, preferredStart: "20:00", preferredEnd: "08:00" }).success).toBe(false);
    // A window narrower than the requested session length.
    expect(plannerPreferencesSchema.safeParse({ ...valid, sessionLength: 90, preferredStart: "08:00", preferredEnd: "09:00" }).success).toBe(false);
    // Out-of-range session length and an unknown intensity value.
    expect(plannerPreferencesSchema.safeParse({ ...valid, sessionLength: 15 }).success).toBe(false);
    expect(plannerPreferencesSchema.safeParse({ ...valid, intensity: "extreme" }).success).toBe(false);
  });

  it("bounds support requests and product feedback", () => {
    expect(supportRequestSchema.safeParse({ subject: "Upload help", message: "The material upload failed after selecting a text file." }).success).toBe(true);
    expect(supportRequestSchema.safeParse({ subject: "No", message: "Too short" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ type: "IDEA", message: "Add a way to duplicate a previous study plan." }).success).toBe(true);
    expect(feedbackSchema.safeParse({ type: "INVALID", message: "This should be rejected." }).success).toBe(false);
  });
});
