import { describe, expect, it } from "vitest";

import { parseTimetableText } from "@/features/planner/timetable-parser";

describe("timetable OCR parsing", () => {
  it("normalizes day aliases, course codes, 12-hour times, and venues", () => {
    const rows = parseTimetableText([
      "Mon COE-201 Data Structures 9am - 11am ECR A1",
      "Tuesday MATH 251 Linear Algebra 14:00 to 16:00 PB123",
    ].join("\n"));

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        courseCode: "COE 201",
        dayOfWeek: "Monday",
        startTime: "09:00",
        endTime: "11:00",
      }),
      expect.objectContaining({
        courseCode: "MATH 251",
        dayOfWeek: "Tuesday",
        startTime: "14:00",
        endTime: "16:00",
      }),
    ]));
  });

  it("deduplicates repeated OCR rows and ignores malformed lines", () => {
    const row = "Wednesday EE 203 Signals 10:00 - 12:00 ENG AUDIT";
    const rows = parseTimetableText(`${row}\n${row}\nnoise without a course or time`);

    expect(rows).toHaveLength(1);
    expect(rows[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("handles representative KNUST timetable table blocks with separate course and venue rows", () => {
    const rows = parseTimetableText([
      "Monday | 07:30 - 09:30 | 10:30 - 12:30",
      "COE 251 | EE 271",
      "PB123 | ECR A1",
      "Thursday | 13:30 - 15:30",
      "MATH 253",
      "Engineering Auditorium",
    ].join("\n"));

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ courseCode: "COE 251", dayOfWeek: "Monday", startTime: "07:30", endTime: "09:30", venue: "PB123" }),
      expect.objectContaining({ courseCode: "EE 271", dayOfWeek: "Monday", startTime: "10:30", endTime: "12:30", venue: "ECR A1" }),
      expect.objectContaining({ courseCode: "MATH 253", dayOfWeek: "Thursday", startTime: "13:30", endTime: "15:30" }),
    ]));
  });
});
