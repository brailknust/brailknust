import { describe, expect, it } from "vitest";

import {
  generateStudySessions,
  hasTimetableConflicts,
  isUsablePreferenceWindow,
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

    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: [{ courseCode: "EE 201", courseName: "Circuit Theory", creditHours: 4 }],
      busyBlocks,
      preferences,
      idFactory: () => `session-${nextId += 1}`,
    });

    expect(unscheduled).toEqual([]);
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
    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: [
        { courseCode: "COE 201", courseName: "Data Structures", creditHours: 4 },
        { courseCode: "MATH 251", courseName: "Linear Algebra", creditHours: 2 },
      ],
      busyBlocks: new Map(),
      preferences,
      idFactory: () => "stable-id",
    });

    expect(unscheduled).toEqual([]);
    expect(new Set(sessions.map((session) => session.subject))).toEqual(new Set([
      "COE 201 - Data Structures",
      "MATH 251 - Linear Algebra",
    ]));
    expect(sessions.filter((session) => session.subject.startsWith("COE 201"))).toHaveLength(3);
    expect(sessions.filter((session) => session.subject.startsWith("MATH 251"))).toHaveLength(1);
  });

  it("covers every course in a single two-hour evening slot per day, and reports the sessions the week has no room left for", () => {
    // 7 courses x 2 sessions each (2 credits, intense) need 14 slots, but a
    // 2-hour window that exactly matches the session length allows only one
    // session per day: 7 slots for the whole week. Every course still gets
    // its first (coverage) session; the second round has nowhere left to go
    // and must be reported, not silently dropped.
    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: Array.from({ length: 7 }, (_, index) => ({ courseCode: `COURSE ${index + 1}`, courseName: `Course ${index + 1}`, creditHours: 2 })),
      busyBlocks: new Map(),
      preferences: { sessionLength: 120, preferredStart: "19:00", preferredEnd: "21:00", intensity: "intense" },
      idFactory: () => crypto.randomUUID(),
    });
    expect(new Set(sessions.map((session) => session.subject))).toHaveLength(7);
    expect(sessions).toHaveLength(7);
    expect(sessions.every((session) => session.startTime === "19:00" && session.endTime === "21:00")).toBe(true);
    expect(unscheduled).toHaveLength(7);
    expect(unscheduled.every((item) => item.missingCount === 1)).toBe(true);
  });

  it("finds a slot the 30-minute grid would miss, instead of reporting a false failure", () => {
    // The only room for a 60-minute session is 08:10-09:10: a short 08:00-08:05
    // busy block sits before it, and the window ends at 09:10. The block
    // applies to every day so the search can't just pick a different,
    // wide-open day instead. The 30-minute grid only ever tests 08:00
    // (blocked) before running past the window; only the finer fallback
    // steps land on 08:10.
    const busyBlocks = new Map<string, BusyBlock[]>(
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => [
        day,
        [{ start: toMinutes("08:00"), end: toMinutes("08:05") }],
      ]),
    );

    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: [{ courseCode: "COE 305", courseName: "Signals", creditHours: 1 }],
      busyBlocks,
      preferences: { sessionLength: 60, preferredStart: "08:00", preferredEnd: "09:10", intensity: "light" },
      idFactory: () => "session",
    });

    expect(unscheduled).toEqual([]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startTime).toBe("08:10");
  });

  it("reports unscheduled courses instead of silently dropping their sessions", () => {
    // A single one-hour slot in the whole week, but two courses each need one
    // session: only one can physically fit.
    const busyBlocks = new Map<string, BusyBlock[]>();
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      busyBlocks.set(day, [{ start: toMinutes("08:00"), end: toMinutes("08:59") }]);
    }

    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: [
        { courseCode: "COE 401", courseName: "Control Systems", creditHours: 1 },
        { courseCode: "COE 402", courseName: "Embedded Systems", creditHours: 1 },
      ],
      busyBlocks,
      preferences: { sessionLength: 60, preferredStart: "08:00", preferredEnd: "09:00", intensity: "light" },
      idFactory: () => "session",
    });

    expect(sessions).toHaveLength(0);
    expect(unscheduled).toHaveLength(2);
    expect(unscheduled.map((item) => item.courseCode).sort()).toEqual(["COE 401", "COE 402"]);
    expect(unscheduled.every((item) => item.missingCount === 1 && item.reason.length > 0)).toBe(true);
  });

  it("reports every course as unscheduled when the preferred window cannot fit one session, without looping", () => {
    const { sessions, unscheduled } = generateStudySessions({
      rows: [],
      courses: [{ courseCode: "COE 201", courseName: "Data Structures", creditHours: 3 }],
      busyBlocks: new Map(),
      preferences: { sessionLength: 60, preferredStart: "09:00", preferredEnd: "09:30", intensity: "balanced" },
      idFactory: () => "session",
    });

    expect(sessions).toEqual([]);
    expect(unscheduled).toEqual([
      {
        courseCode: "COE 201",
        courseName: "Data Structures",
        missingCount: 2,
        reason: "Your preferred study window is too short to fit a session of this length.",
      },
    ]);
  });

  it("treats an inverted or malformed preferred window as unusable", () => {
    expect(isUsablePreferenceWindow({ sessionLength: 60, preferredStart: "10:00", preferredEnd: "09:00" })).toBe(false);
    expect(isUsablePreferenceWindow({ sessionLength: 60, preferredStart: "not-a-time", preferredEnd: "12:00" })).toBe(false);
    expect(isUsablePreferenceWindow({ sessionLength: 60, preferredStart: "08:00", preferredEnd: "09:00" })).toBe(true);
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
