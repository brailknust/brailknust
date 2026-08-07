import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import { computerEngineeringCurricula } from "../src/data/curricula/computer-engineering.ts";

config({ path: path.resolve(".env.local") });

const prisma = new PrismaClient();
const reportPath = path.resolve("import-reports/knust-launch-scope-verification.json");
const materialReportPath = path.resolve("import-reports/coe-first-semester-import-verification.json");

function configuredAdminEmails() {
  return [...new Set((process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean))];
}

function groupTemplates(templates) {
  const groups = new Map();
  for (const template of templates) {
    const key = [template.college, template.department, template.program, template.version].join("|");
    const group = groups.get(key) ?? { ...template, templates: [] };
    group.templates.push(template);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function termForSemester(semester) {
  if (semester === "First Semester") return "FIRST";
  if (semester === "Second Semester") return "SECOND";
  throw new Error(`Unsupported semester label: ${semester}`);
}

function validateTemplates(templates) {
  const issues = [];
  for (const group of groupTemplates(templates)) {
    const expectedTerms = group.durationYears * group.termsPerYear;
    if (group.templates.length !== expectedTerms) {
      issues.push(`${group.program} ${group.version} declares ${group.templates.length}/${expectedTerms} term templates.`);
    }
    const activeCodes = new Set(group.templates.flatMap((template) => template.courses.map((course) => course.code)));
    for (const template of group.templates) {
      if (!template.source?.trim()) issues.push(`${template.level} ${template.semester} has no source note.`);
      for (const course of template.courses) {
        if ((course.courseKind ?? "CORE") === "ELECTIVE" && !course.electiveGroup?.trim()) {
          issues.push(`${course.code} is elective but has no elective group.`);
        }
        if (course.replacesCourseCode === course.code || (course.replacesCourseCode && activeCodes.has(course.replacesCourseCode))) {
          issues.push(`${course.code} has an invalid predecessor-code rule.`);
        }
      }
    }
  }
  return issues;
}

async function loadMaterialSummary() {
  const materialReport = JSON.parse(await readFile(materialReportPath, "utf8"));
  const issueCount = [
    ...materialReport.missingHashes,
    ...materialReport.materialsWithoutStorage,
    ...materialReport.materialsWithoutChunks,
    ...materialReport.materialsWithoutTopics,
  ].length;
  return {
    verifiedAt: materialReport.verifiedAt,
    expectedApprovedFiles: materialReport.expectedApprovedFiles,
    publishedFiles: materialReport.publishedFiles,
    passed: issueCount === 0 && materialReport.publishedFiles === materialReport.expectedApprovedFiles,
  };
}

async function syncProgramme(group) {
  const existing = await prisma.programmeCurriculum.findUnique({
    where: {
      college_programme_version: {
        college: group.college,
        programme: group.program,
        version: group.version,
      },
    },
    include: { importedFrom: { select: { id: true } } },
  });

  if (existing?.importedFrom) return { curriculumId: existing.id, skippedAuthoritativeImport: true };

  const curriculum = await prisma.programmeCurriculum.upsert({
    where: {
      college_programme_version: {
        college: group.college,
        programme: group.program,
        version: group.version,
      },
    },
    create: {
      college: group.college,
      department: group.department,
      programme: group.program,
      version: group.version,
      durationYears: group.durationYears,
      termsPerYear: group.termsPerYear,
      source: group.source,
      isPublished: true,
    },
    update: {
      department: group.department,
      durationYears: group.durationYears,
      termsPerYear: group.termsPerYear,
      source: group.source,
      isPublished: true,
    },
  });

  for (const template of group.templates) {
    const term = await prisma.programmeCurriculumTerm.upsert({
      where: {
        curriculumId_level_term: {
          curriculumId: curriculum.id,
          level: template.level,
          term: termForSemester(template.semester),
        },
      },
      create: {
        curriculumId: curriculum.id,
        level: template.level,
        term: termForSemester(template.semester),
        name: template.semester,
        source: template.source,
      },
      update: { name: template.semester, source: template.source },
    });

    for (const course of template.courses) {
      await prisma.programmeCurriculumCourse.upsert({
        where: { curriculumTermId_courseCode: { curriculumTermId: term.id, courseCode: course.code } },
        create: {
          curriculumTermId: term.id,
          courseCode: course.code,
          courseName: course.name,
          creditHours: course.creditHours,
          courseKind: course.courseKind ?? "CORE",
          electiveGroup: course.electiveGroup,
          replacesCourseCode: course.replacesCourseCode,
          isApproved: true,
          source: template.source,
        },
        update: {
          courseName: course.name,
          creditHours: course.creditHours,
          courseKind: course.courseKind ?? "CORE",
          electiveGroup: course.electiveGroup ?? null,
          replacesCourseCode: course.replacesCourseCode ?? null,
          isApproved: true,
          source: template.source,
        },
      });
    }
  }

  return { curriculumId: curriculum.id, skippedAuthoritativeImport: false };
}

try {
  const adminEmails = configuredAdminEmails();
  if (adminEmails.length === 0) throw new Error("ADMIN_EMAILS must contain at least one configured administrator.");

  const actor = await prisma.user.findFirst({
    where: { email: { in: adminEmails, mode: "insensitive" }, role: "ADMIN", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!actor) throw new Error("No active administrator matches the configured administrator allow-list.");

  const templateIssues = validateTemplates(computerEngineeringCurricula);
  if (templateIssues.length > 0) throw new Error(`Bundled curriculum verification failed: ${templateIssues.join(" ")}`);

  const groups = groupTemplates(computerEngineeringCurricula);
  const syncResults = [];
  for (const group of groups) syncResults.push(await syncProgramme(group));

  const curriculumIds = syncResults.map((result) => result.curriculumId);
  const stored = await prisma.programmeCurriculum.findMany({
    where: { id: { in: curriculumIds } },
    select: {
      id: true,
      terms: { select: { courses: { select: { courseKind: true, replacesCourseCode: true } } } },
    },
  });
  const storedTerms = stored.reduce((sum, curriculum) => sum + curriculum.terms.length, 0);
  const storedCourses = stored.reduce((sum, curriculum) => sum + curriculum.terms.reduce((termSum, term) => termSum + term.courses.length, 0), 0);
  const declaredCourses = computerEngineeringCurricula.reduce((sum, template) => sum + template.courses.length, 0);
  const materialImport = await loadMaterialSummary();
  const report = {
    verifiedAt: new Date().toISOString(),
    scope: "Bundled, user-provided launch-scope declarations; external KNUST approval remains separately required.",
    programmeVersions: groups.length,
    declaredTerms: computerEngineeringCurricula.length,
    storedTerms,
    declaredCourses,
    storedCourses,
    electiveRules: computerEngineeringCurricula.flatMap((template) => template.courses).filter((course) => course.courseKind === "ELECTIVE").length,
    renamedCodeRules: computerEngineeringCurricula.flatMap((template) => template.courses).filter((course) => course.replacesCourseCode).length,
    authoritativeImportsPreserved: syncResults.filter((result) => result.skippedAuthoritativeImport).length,
    internallyComplete: storedTerms >= computerEngineeringCurricula.length && storedCourses >= declaredCourses,
    materialImport,
  };

  await prisma.adminContentAudit.create({
    data: {
      actorId: actor.id,
      action: "BUNDLED_CURRICULA_SYNCED_OPERATIONALLY",
      targetType: "CATALOG",
      targetId: "bundled-curricula",
      targetLabel: "Bundled curriculum catalogue",
      metadata: {
        programmeVersions: report.programmeVersions,
        declaredTerms: report.declaredTerms,
        storedTerms: report.storedTerms,
        declaredCourses: report.declaredCourses,
        storedCourses: report.storedCourses,
        authoritativeImportsPreserved: report.authoritativeImportsPreserved,
      },
    },
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
