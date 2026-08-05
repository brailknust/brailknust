import { describe, expect, it } from "vitest";

import { parseCurriculumCsv } from "@/features/admin/curriculum-import";

describe("curriculum CSV import", () => {
  it("parses a valid curriculum row", () => {
    const rows = parseCurriculumCsv("courseCode,courseName,creditHours,level,term\nCENG 201,Circuit Theory,3,LEVEL_200,FIRST");
    expect(rows).toEqual([expect.objectContaining({ courseCode: "CENG 201", courseName: "Circuit Theory", creditHours: 3, level: "LEVEL_200", term: "FIRST", error: null })]);
  });

  it("reports missing headers and invalid data without accepting the import", () => {
    expect(parseCurriculumCsv("code,name\nCENG 201,Circuit Theory")[0].error).toContain("Required headers");
    const [row] = parseCurriculumCsv("courseCode,courseName,creditHours,level,term\nCENG 201,Circuit Theory,20,LEVEL_700,third");
    expect(row.error).toContain("credit hours must be 1-12");
    expect(row.error).toContain("level must be LEVEL_100 through LEVEL_600");
  });

  it("rejects duplicate courses in the same curriculum term", () => {
    const rows = parseCurriculumCsv("courseCode,courseName,creditHours,level,term\nCENG 201,Circuit Theory,3,LEVEL_200,FIRST\nCENG 201,Circuit Theory II,3,LEVEL_200,FIRST");
    expect(rows[1].error).toContain("duplicate course in this term");
  });
});
