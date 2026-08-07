import { describe, expect, it } from "vitest";

import { computerEngineeringCurricula } from "@/data/curricula/computer-engineering";
import { verifyCurriculumTemplates, verifyMaterialImportReport } from "@/features/admin/curriculum-verification";

describe("launch curriculum verification", () => {
  it("verifies every declared Computer Engineering slot and renamed-code rule", () => {
    const result = verifyCurriculumTemplates(computerEngineeringCurricula);
    expect(result).toMatchObject({ internallyComplete: true, termCount: 8, renamedCodeCount: 1, electiveCount: 0 });
    expect(result.courseCount).toBeGreaterThan(40);
  });

  it("reports missing terms and malformed elective rules", () => {
    const [template] = computerEngineeringCurricula;
    const result = verifyCurriculumTemplates([{ ...template, courses: [{ code: "COE 199", name: "Optional", creditHours: 2, courseKind: "ELECTIVE" }] }]);
    expect(result.internallyComplete).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["MISSING_ELECTIVE_GROUP", "MISSING_TERM"]));
  });

  it("requires material counts, searchable records, topics, and curriculum scope to agree", () => {
    const manifest = { files: [{ status: "APPROVED", courseCode: "COE 181", title: "Slides", sha256: "hash" }] };
    const complete = verifyMaterialImportReport(manifest, { verifiedAt: "2026-08-01T00:00:00Z", expectedApprovedFiles: 1, publishedFiles: 1, missingHashes: [], materialsWithoutStorage: [], materialsWithoutChunks: [], materialsWithoutTopics: [] }, new Set(["COE 181"]));
    expect(complete).toMatchObject({ complete: true, approvedFiles: 1, coveredCourseCount: 1 });
    const incomplete = verifyMaterialImportReport(manifest, { verifiedAt: "2026-08-01T00:00:00Z", expectedApprovedFiles: 1, publishedFiles: 0, missingHashes: ["COE 181|Slides"], materialsWithoutStorage: [], materialsWithoutChunks: [], materialsWithoutTopics: [] }, new Set());
    expect(incomplete.complete).toBe(false);
    expect(incomplete.issues).toEqual(expect.arrayContaining([expect.stringContaining("Missing material"), expect.stringContaining("Outside curriculum scope")]));
  });
});
