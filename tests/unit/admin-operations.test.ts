import { describe, expect, it } from "vitest";

import { safeAuditMetadata } from "@/features/admin/audit";
import { filterCatalogCourses, paginateCatalog } from "@/features/admin/catalog-operations";

const courses = [
  { id: "1", code: "COE 101", name: "Engineering", department: "Computer Engineering", level: "LEVEL_100", approvalStatus: "OFFICIAL" as const },
  { id: "2", code: "MATH 251", name: "Linear Algebra", department: "Mathematics", level: "LEVEL_200", approvalStatus: "PENDING" as const },
  { id: "3", code: "COE 301", name: "Networks", department: null, level: "LEVEL_300", approvalStatus: "REJECTED" as const },
];

describe("admin catalog operations", () => {
  it("combines search, status, level, and assignment filters", () => {
    expect(filterCatalogCourses(courses, { query: "linear", approval: "PENDING", assignment: "UNASSIGNED", level: "LEVEL_200" }, new Set(["COE 101"]))).toEqual([courses[1]]);
    expect(filterCatalogCourses(courses, { query: "computer", approval: "ALL", assignment: "CONFIGURED", level: "" }, new Set(["COE 101"]))).toEqual([courses[0]]);
  });

  it("clamps pagination to an available page", () => {
    expect(paginateCatalog(courses, 99, 2)).toEqual({ items: [courses[2]], page: 2, pageCount: 2, total: 3 });
    expect(paginateCatalog([], -4, 20)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});

describe("audit metadata minimization", () => {
  it("drops sensitive and nested values while bounding retained metadata", () => {
    const metadata = safeAuditMetadata({
      courseId: "course-1",
      accessToken: "never-store-this",
      studentEmail: "student@example.com",
      rawContent: "private material",
      changedFields: ["title", "sequence"],
      nested: { unsafe: true },
      long: "x".repeat(500),
    });
    expect(metadata).toEqual(expect.objectContaining({ courseId: "course-1", changedFields: ["title", "sequence"] }));
    expect(metadata).not.toHaveProperty("accessToken");
    expect(metadata).not.toHaveProperty("studentEmail");
    expect(metadata).not.toHaveProperty("rawContent");
    expect(metadata).not.toHaveProperty("nested");
    expect(metadata.long).toHaveLength(300);
  });
});
