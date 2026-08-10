import { describe, expect, it } from "vitest";

import { calculateConfirmedAttendance } from "@/features/academics/calculations";

describe("calculateConfirmedAttendance", () => {
  it("returns null when there are no records at all", () => {
    expect(calculateConfirmedAttendance([])).toBeNull();
  });

  it("returns null when every record is still UNCONFIRMED", () => {
    expect(calculateConfirmedAttendance([{ status: "UNCONFIRMED" }, { status: "UNCONFIRMED" }])).toBeNull();
  });

  it("counts a single attended class as 1/1 (100%)", () => {
    expect(calculateConfirmedAttendance([{ status: "ATTENDED" }])).toEqual({ attended: 1, total: 1, percentage: 100 });
  });

  it("counts attended then missed as 1/2 (50%), matching the week-over-week example", () => {
    expect(calculateConfirmedAttendance([{ status: "ATTENDED" }, { status: "MISSED" }])).toEqual({ attended: 1, total: 2, percentage: 50 });
  });

  it("excludes CANCELLED and EXCUSED from both the numerator and the denominator", () => {
    const result = calculateConfirmedAttendance([
      { status: "ATTENDED" },
      { status: "CANCELLED" },
      { status: "EXCUSED" },
      { status: "MISSED" },
    ]);
    expect(result).toEqual({ attended: 1, total: 2, percentage: 50 });
  });

  it("ignores still-pending UNCONFIRMED records mixed in with confirmed ones", () => {
    const result = calculateConfirmedAttendance([
      { status: "ATTENDED" },
      { status: "UNCONFIRMED" },
    ]);
    expect(result).toEqual({ attended: 1, total: 1, percentage: 100 });
  });

  it("rounds the percentage to the nearest whole number", () => {
    const result = calculateConfirmedAttendance([
      { status: "ATTENDED" },
      { status: "ATTENDED" },
      { status: "MISSED" },
    ]);
    expect(result).toEqual({ attended: 2, total: 3, percentage: 67 });
  });

  it("returns 0% when every confirmed class was missed", () => {
    expect(calculateConfirmedAttendance([{ status: "MISSED" }, { status: "MISSED" }])).toEqual({ attended: 0, total: 2, percentage: 0 });
  });
});
