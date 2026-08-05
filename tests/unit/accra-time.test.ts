import { describe, expect, it } from "vitest";

import {
  accraWeekBounds,
  formatAccraDateTimeInput,
  parseAccraDate,
  parseAccraDateTime,
} from "@/features/academics/time";

describe("Africa/Accra academic time helpers", () => {
  it("parses local Accra date and datetime inputs as stable UTC instants", () => {
    expect(parseAccraDate("2026-08-05")?.toISOString()).toBe("2026-08-05T00:00:00.000Z");
    expect(parseAccraDateTime("2026-08-05T23:30")?.toISOString()).toBe("2026-08-05T23:30:00.000Z");
  });

  it("formats datetime-local inputs without shifting the Ghana day", () => {
    expect(formatAccraDateTimeInput(new Date("2026-08-05T23:30:00.000Z"))).toBe("2026-08-05T23:30");
  });

  it("uses Monday as the start of the Accra academic week", () => {
    const { start, end } = accraWeekBounds(new Date("2026-08-09T12:00:00.000Z"));

    expect(start.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});
