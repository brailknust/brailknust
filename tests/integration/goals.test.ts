import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  profile: vi.fn(),
  enrollments: vi.fn(),
  goals: vi.fn(),
  tasks: vi.fn(),
  studyItems: vi.fn(),
  assessments: vi.fn(),
  masteries: vi.fn(),
  attempts: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.user },
    semesterProfile: { findUnique: mocks.profile },
    enrollment: { findMany: mocks.enrollments },
    goal: { findMany: mocks.goals },
    task: { findMany: mocks.tasks },
    studyPlanItem: { findMany: mocks.studyItems },
    assessment: { findMany: mocks.assessments },
    topicMastery: { findMany: mocks.masteries },
    diagnosticAttempt: { findMany: mocks.attempts },
  },
}));

import { getGoalsPageData } from "@/features/goals/queries";

const baseGoal = {
  id: "goal",
  userId: "user-1",
  semesterId: "semester-1",
  courseId: null,
  title: "Goal",
  category: "ACADEMIC",
  period: "SEMESTER",
  currentValue: 0,
  targetValue: 10,
  deadline: null,
  status: "ACTIVE",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  course: null,
};

describe("automatic goal progress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
    mocks.user.mockResolvedValue({ activeSemesterId: "semester-1", activeSemester: { id: "semester-1" } });
    mocks.profile.mockResolvedValue({ cwa: 71.5 });
    mocks.enrollments.mockResolvedValue([]);
    mocks.goals.mockResolvedValue([
      { ...baseGoal, id: "cwa", metric: "CWA", targetValue: 70 },
      { ...baseGoal, id: "tasks", metric: "TASKS_COMPLETED", targetValue: 4, period: "WEEKLY" },
      { ...baseGoal, id: "study", metric: "STUDY_MINUTES", targetValue: 180 },
      { ...baseGoal, id: "average", metric: "ASSESSMENT_AVERAGE", targetValue: 80 },
    ]);
    mocks.tasks.mockResolvedValue([
      { courseId: null, updatedAt: new Date("2026-08-05T09:00:00.000Z") },
      { courseId: null, updatedAt: new Date("2026-07-20T09:00:00.000Z") },
    ]);
    mocks.studyItems.mockResolvedValue([
      { courseId: null, durationMinutes: 90, scheduledStart: new Date("2026-07-20T09:00:00.000Z") },
      { courseId: null, durationMinutes: 60, scheduledStart: new Date("2026-08-05T09:00:00.000Z") },
    ]);
    mocks.assessments.mockResolvedValue([
      { courseId: null, score: 8, maxScore: 10, assessedAt: new Date("2026-08-01T00:00:00.000Z"), createdAt: new Date("2026-08-01T00:00:00.000Z") },
      { courseId: null, score: 18, maxScore: 20, assessedAt: new Date("2026-08-02T00:00:00.000Z"), createdAt: new Date("2026-08-02T00:00:00.000Z") },
    ]);
    mocks.masteries.mockResolvedValue([]);
    mocks.attempts.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it("calculates CWA, weekly tasks, study minutes, and assessment averages", async () => {
    const result = await getGoalsPageData("user-1");
    const goals = new Map(result.goals.map((goal) => [goal.id, goal]));

    expect(goals.get("cwa")).toMatchObject({ currentValue: 71.5, progress: 100, targetReached: true });
    expect(goals.get("tasks")).toMatchObject({ currentValue: 1, progress: 25, targetReached: false });
    expect(goals.get("study")).toMatchObject({ currentValue: 150, progress: 83, targetReached: false });
    expect(goals.get("average")).toMatchObject({ currentValue: 85, progress: 100, targetReached: true });
  });
});
