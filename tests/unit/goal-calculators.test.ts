import { describe, expect, it } from "vitest";
import { calculateCwaGoal, calculateManualGoal, calculatePracticeQuestionGoal, calculateStudyTimeGoal } from "@/features/goals/calculators";
describe("goal calculators", () => {
  it("calculates measurable progress", () => { expect(calculateCwaGoal(72, 75)).toMatchObject({ progress: 96, targetReached: false }); expect(calculateStudyTimeGoal(360, 360)).toMatchObject({ targetReached: true }); expect(calculatePracticeQuestionGoal(12, 40).progress).toBe(30); });
  it("keeps manual progress explicit", () => expect(calculateManualGoal(4, 5).targetReached).toBe(false));
});
