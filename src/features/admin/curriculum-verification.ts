import type { CurriculumTemplate } from "@/data/curricula";

export type CurriculumVerificationIssue = {
  code: string;
  scope: string;
  message: string;
};

const courseCodePattern = /^[A-Z]{2,12}\s?\d{2,4}[A-Z]?$/;
const levelOrder = ["LEVEL_100", "LEVEL_200", "LEVEL_300", "LEVEL_400", "LEVEL_500", "LEVEL_600"];

export function verifyCurriculumTemplates(templates: CurriculumTemplate[]) {
  const issues: CurriculumVerificationIssue[] = [];
  const templateKeys = new Set<string>();
  const replacementOwners = new Map<string, string>();
  const activeCourseCodes = new Set(templates.flatMap((template) => template.courses.map((course) => course.code)));
  let courseCount = 0;
  let electiveCount = 0;
  let renamedCodeCount = 0;

  for (const template of templates) {
    const scope = `${template.program} ${template.version} ${template.level} ${template.semester}`;
    const key = `${template.college}|${template.department}|${scope}`;
    if (templateKeys.has(key)) issues.push({ code: "DUPLICATE_TERM", scope, message: "The curriculum term is declared more than once." });
    templateKeys.add(key);
    if (!template.source?.trim()) issues.push({ code: "MISSING_SOURCE", scope, message: "The curriculum term has no source or approval reference." });
    const codes = new Set<string>();
    for (const course of template.courses) {
      courseCount += 1;
      const courseScope = `${scope} ${course.code}`;
      if (!courseCodePattern.test(course.code)) issues.push({ code: "INVALID_COURSE_CODE", scope: courseScope, message: "The course code format is invalid." });
      if (!course.name.trim() || course.creditHours < 1 || course.creditHours > 12) issues.push({ code: "INVALID_COURSE_DETAILS", scope: courseScope, message: "Course name and credit hours must be complete." });
      if (codes.has(course.code)) issues.push({ code: "DUPLICATE_COURSE", scope: courseScope, message: "The course appears more than once in this term." });
      codes.add(course.code);
      if ((course.courseKind ?? "CORE") === "ELECTIVE") {
        electiveCount += 1;
        if (!course.electiveGroup?.trim()) issues.push({ code: "MISSING_ELECTIVE_GROUP", scope: courseScope, message: "Elective courses require a selection group." });
      } else if (course.electiveGroup) {
        issues.push({ code: "CORE_WITH_ELECTIVE_GROUP", scope: courseScope, message: "Core courses cannot belong to an elective group." });
      }
      if (course.replacesCourseCode) {
        renamedCodeCount += 1;
        if (!courseCodePattern.test(course.replacesCourseCode) || course.replacesCourseCode === course.code) issues.push({ code: "INVALID_REPLACEMENT_CODE", scope: courseScope, message: "The predecessor course code is invalid." });
        if (activeCourseCodes.has(course.replacesCourseCode)) issues.push({ code: "ACTIVE_REPLACEMENT_CODE", scope: courseScope, message: "The predecessor code is also active in this curriculum version." });
        const existingOwner = replacementOwners.get(course.replacesCourseCode);
        if (existingOwner && existingOwner !== course.code) issues.push({ code: "AMBIGUOUS_REPLACEMENT", scope: courseScope, message: `${course.replacesCourseCode} already maps to ${existingOwner}.` });
        replacementOwners.set(course.replacesCourseCode, course.code);
      }
    }
  }

  const programmes = new Map<string, CurriculumTemplate[]>();
  for (const template of templates) {
    const key = `${template.college}|${template.department}|${template.program}|${template.version}`;
    programmes.set(key, [...(programmes.get(key) ?? []), template]);
  }
  for (const [scope, programmeTemplates] of programmes) {
    const definition = programmeTemplates[0];
    const expectedSlots = levelOrder.slice(0, definition.durationYears).flatMap((level) => Array.from({ length: definition.termsPerYear }, (_, index) => `${level}|${index === 0 ? "First Semester" : "Second Semester"}`));
    const actualSlots = new Set(programmeTemplates.map((template) => `${template.level}|${template.semester}`));
    for (const slot of expectedSlots) if (!actualSlots.has(slot)) issues.push({ code: "MISSING_TERM", scope, message: `Missing ${slot.replace("|", " ")}.` });
  }

  return {
    internallyComplete: issues.length === 0,
    programmeVersions: programmes.size,
    termCount: templates.length,
    courseCount,
    electiveCount,
    renamedCodeCount,
    issues,
  };
}

type MaterialManifest = { files: Array<{ status: string; courseCode: string; title: string; sha256: string }> };
type MaterialVerificationReport = {
  verifiedAt: string;
  expectedApprovedFiles: number;
  publishedFiles: number;
  missingHashes: string[];
  materialsWithoutStorage: string[];
  materialsWithoutChunks: string[];
  materialsWithoutTopics: string[];
};

export function verifyMaterialImportReport(manifest: MaterialManifest, report: MaterialVerificationReport, launchCourseCodes: Set<string>) {
  const approved = manifest.files.filter((file) => file.status === "APPROVED");
  const outOfScopeFiles = approved.filter((file) => !launchCourseCodes.has(file.courseCode)).map((file) => `${file.courseCode}|${file.title}`);
  const issues = [
    ...report.missingHashes.map((item) => `Missing material: ${item}`),
    ...report.materialsWithoutStorage.map((item) => `Missing storage: ${item}`),
    ...report.materialsWithoutChunks.map((item) => `Missing chunks: ${item}`),
    ...report.materialsWithoutTopics.map((item) => `Missing topics: ${item}`),
    ...outOfScopeFiles.map((item) => `Outside curriculum scope: ${item}`),
  ];
  if (approved.length !== report.expectedApprovedFiles) issues.push("The manifest approved count differs from the verification report.");
  if (report.publishedFiles !== report.expectedApprovedFiles) issues.push("Not every approved material is published.");
  return {
    complete: issues.length === 0,
    approvedFiles: approved.length,
    publishedFiles: report.publishedFiles,
    verifiedAt: report.verifiedAt,
    coveredCourseCount: new Set(approved.map((file) => file.courseCode)).size,
    issues,
  };
}
