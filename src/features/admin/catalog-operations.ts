export type CatalogApprovalFilter = "ALL" | "OFFICIAL" | "PENDING" | "REJECTED";
export type CatalogAssignmentFilter = "ALL" | "CONFIGURED" | "UNASSIGNED";

type CatalogCourse = {
  id: string;
  code: string;
  name: string;
  department: string | null;
  level: string | null;
  approvalStatus: "OFFICIAL" | "PENDING" | "REJECTED";
};

export function filterCatalogCourses<T extends CatalogCourse>(
  courses: T[],
  filters: {
    query: string;
    approval: CatalogApprovalFilter;
    assignment: CatalogAssignmentFilter;
    level: string;
  },
  configuredCodes: Set<string>,
): T[] {
  const query = filters.query.trim().toLocaleLowerCase().slice(0, 80);
  return courses.filter((course) => {
    const matchesQuery = !query || [course.code, course.name, course.department ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(query));
    const matchesApproval = filters.approval === "ALL" || course.approvalStatus === filters.approval;
    const matchesLevel = !filters.level || course.level === filters.level;
    const configured = configuredCodes.has(course.code);
    const matchesAssignment = filters.assignment === "ALL"
      || (filters.assignment === "CONFIGURED" ? configured : !configured);
    return matchesQuery && matchesApproval && matchesLevel && matchesAssignment;
  });
}

export function paginateCatalog<T>(items: T[], requestedPage: number, pageSize = 20) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1), pageCount);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageCount, total: items.length };
}
