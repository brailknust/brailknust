import { describe, expect, it } from "vitest";

import {
  sortTasksByImportanceAndDueDate,
  withEffectiveTaskStatus,
} from "@/features/tasks/status";

describe("task status and ordering", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");

  it("expires unfinished tasks only after their due time", () => {
    expect(withEffectiveTaskStatus({ status: "TODO" as const, dueAt: new Date("2026-08-04T11:59:00.000Z") }, now).status).toBe("EXPIRED");
    expect(withEffectiveTaskStatus({ status: "IN_PROGRESS" as const, dueAt: new Date("2026-08-04T11:59:00.000Z") }, now).status).toBe("EXPIRED");
    expect(withEffectiveTaskStatus({ status: "DONE" as const, dueAt: new Date("2026-08-04T11:59:00.000Z") }, now).status).toBe("DONE");
    expect(withEffectiveTaskStatus({ status: "TODO" as const, dueAt: now }, now).status).toBe("TODO");
  });

  it("sorts actionable urgent work before expired and completed work", () => {
    const tasks = [
      { id: "done", status: "DONE" as const, priority: "URGENT" as const, dueAt: now, createdAt: now },
      { id: "medium", status: "TODO" as const, priority: "MEDIUM" as const, dueAt: new Date("2026-08-05T10:00:00.000Z"), createdAt: now },
      { id: "urgent", status: "TODO" as const, priority: "URGENT" as const, dueAt: new Date("2026-08-06T10:00:00.000Z"), createdAt: now },
      { id: "expired", status: "EXPIRED" as const, priority: "URGENT" as const, dueAt: new Date("2026-08-03T10:00:00.000Z"), createdAt: now },
    ];

    expect(sortTasksByImportanceAndDueDate(tasks).map((task) => task.id)).toEqual([
      "urgent",
      "medium",
      "expired",
      "done",
    ]);
  });
});
