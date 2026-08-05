import type { GoalMetric } from "@prisma/client";

export type GoalProgressValues = {
  currentValue: number;
  targetValue: number;
  progress: number;
  targetReached: boolean;
};

export type GoalProgressSnapshotValue = {
  currentValue: number;
  targetValue: number;
  progress: number;
  metric: GoalMetric;
};

export function calculateGoalProgress(currentValue: number, targetValue: number): GoalProgressValues {
  const current = Math.round(currentValue * 10) / 10;
  const target = Number.isFinite(targetValue) ? targetValue : 0;
  const progress = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  return {
    currentValue: current,
    targetValue: target,
    progress,
    targetReached: current >= target,
  };
}

export function shouldRecordGoalProgressSnapshot(
  latest: GoalProgressSnapshotValue | null | undefined,
  next: GoalProgressSnapshotValue,
) {
  if (!latest) return true;
  return (
    latest.metric !== next.metric ||
    latest.currentValue !== next.currentValue ||
    latest.targetValue !== next.targetValue ||
    latest.progress !== next.progress
  );
}
