import { describe, expect, it } from "vitest";

import { diagnosticFeedbackSchema } from "@/features/diagnostics/feedback";

describe("diagnostic feedback", () => {
  const quizId = "00000000-0000-4000-8000-000000000001";

  it("accepts a bounded rating and optional student note", () => {
    expect(diagnosticFeedbackSchema.safeParse({ quizId, rating: "5", comment: "Useful questions." }).success).toBe(true);
  });

  it("rejects ratings outside the one-to-five scale", () => {
    expect(diagnosticFeedbackSchema.safeParse({ quizId, rating: 0 }).success).toBe(false);
    expect(diagnosticFeedbackSchema.safeParse({ quizId, rating: 6 }).success).toBe(false);
  });
});
