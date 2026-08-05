import { describe, expect, it } from "vitest";

import { calculateGoalProgress, shouldRecordGoalProgressSnapshot } from "@/features/goals/progress";

describe("goal progress snapshots", () => {
  it("calculates bounded progress and target state", () => {
    expect(calculateGoalProgress(74.56, 80)).toMatchObject({
      currentValue: 74.6,
      targetValue: 80,
      progress: 93,
      targetReached: false,
    });
    expect(calculateGoalProgress(105, 100).progress).toBe(100);
  });

  it("records only meaningful progress changes", () => {
    const latest = { currentValue: 10, targetValue: 20, progress: 50, metric: "TASKS_COMPLETED" as const };

    expect(shouldRecordGoalProgressSnapshot(latest, latest)).toBe(false);
    expect(shouldRecordGoalProgressSnapshot(latest, { ...latest, currentValue: 11, progress: 55 })).toBe(true);
  });
});
