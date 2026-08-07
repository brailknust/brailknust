import fixtures from "../../evaluations/timetable-ocr.json";
import { describe, expect, it } from "vitest";

import { parseTimetableText } from "@/features/planner/timetable-parser";

describe("representative timetable evaluation set", () => {
  for (const fixture of fixtures.cases) {
    it(`parses ${fixture.id}`, () => {
      const rows = parseTimetableText(fixture.text);
      expect(rows).toEqual(expect.arrayContaining(fixture.expected.map((expected) => expect.objectContaining(expected))));
      expect(rows).toHaveLength(fixture.expected.length);
    });
  }
});
