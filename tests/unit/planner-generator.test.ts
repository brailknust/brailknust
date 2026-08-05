import { describe, expect, it } from "vitest";

import {
  generateStudySessions,
  hasTimetableConflicts,
  isValidTimetableRow,
  overlaps,
  sessionsForCourse,
  toMinutes,
  type BusyBlock,
} from "@/features/planner/generator";

const preferences = {
  sessionLength: 60,
  preferredStart: "08:00",
  preferredEnd: "12:00",
  intensity: "balanced" as const,
};

describe("study-plan generation", () => {
  it("avoids saved busy blocks and collisions between generated sessions", () => {
    const busyBlocks = new Map<string, BusyBlock[]>([
      ["Monday", [{ start: toMinutes("08:00"), end: toMinutes("12:00") }]],
      ["Tuesday", [{ start: toMinutes("08:00"), end: toMinutes("09:30") }]],
    ]);
    let nextId = 0;

    const sessions = generateStudySessions({
      rows: [],
      courses: [{ courseCode: "EE 201", courseName: "Circuit Theory", creditHours: 4 }],
      busyBlocks,
      preferences,
      idFactory: () => `session-${nextId += 1}`,
    });

    expect(sessions).toHaveLength(3);
    for (const session of sessions) {
      const start = toMinutes(session.startTime);
      const end = toMinutes(session.endTime);
      expect((busyBlocks.get(session.dayOfWeek) ?? []).some((block) => overlaps(start, end, block))).toBe(false);
    }
    for (let left = 0; left < sessions.length; left += 1) {
      for (let right = left + 1; right < sessions.length; right += 1) {
        if (sessions[left].dayOfWeek !== sessions[right].dayOfWeek) continue;
        expect(overlaps(
          toMinutes(sessions[left].startTime),
          toMinutes(sessions[left].endTime),
          { start: toMinutes(sessions[right].startTime), end: toMinutes(sessions[right].endTime) },
        )).toBe(false);
      }
    }
  });

  it("gives every course coverage before adding weighted sessions", () => {
    const sessions = generateStudySessions({
      rows: [],
      courses: [
        { courseCode: "COE 201", courseName: "Data Structures", creditHours: 4 },
        { courseCode: "MATH 251", courseName: "Linear Algebra", creditHours: 2 },
      ],
      busyBlocks: new Map(),
      preferences,
      idFactory: () => "stable-id",
    });

    expect(new Set(sessions.map((session) => session.subject))).toEqual(new Set([
      "COE 201 - Data Structures",
      "MATH 251 - Linear Algebra",
    ]));
    expect(sessions.filter((session) => session.subject.startsWith("COE 201"))).toHaveLength(3);
    expect(sessions.filter((session) => session.subject.startsWith("MATH 251"))).toHaveLength(1);
  });

  it("validates timetable rows and clamps credit-hour targets", () => {
    const validRow = {
      id: "row-1",
      courseCode: "COE 201",
      courseName: "Data Structures",
      dayOfWeek: "Monday",
      startTime: "09:00",
      endTime: "10:00",
    };

    expect(isValidTimetableRow(validRow)).toBe(true);
    expect(isValidTimetableRow({ ...validRow, endTime: "08:00" })).toBe(false);
    expect(isValidTimetableRow({ ...validRow, startTime: "25:00" })).toBe(false);
    expect(isValidTimetableRow({ ...validRow, dayOfWeek: "Funday" })).toBe(false);
    expect(hasTimetableConflicts([
      validRow,
      { ...validRow, id: "row-2", courseCode: "COE 202", startTime: "09:30", endTime: "10:30" },
    ])).toBe(true);
    expect(hasTimetableConflicts([
      validRow,
      { ...validRow, id: "row-2", courseCode: "COE 202", dayOfWeek: "Tuesday" },
    ])).toBe(false);
    expect(sessionsForCourse(0, "intense")).toBe(1);
    expect(sessionsForCourse(8, "balanced")).toBe(3);
  });
});
