import "server-only";

import type { AcademicLevel, SemesterTerm } from "@prisma/client";
import { findProgrammeCurriculum, getCurriculumVersions, knustCurricula } from "@/data/curricula";
import { prisma } from "@/server/db";

const levels: AcademicLevel[] = ["LEVEL_100", "LEVEL_200", "LEVEL_300", "LEVEL_400", "LEVEL_500", "LEVEL_600"];
const academicYearPattern = /^(\d{4})\/(\d{4})$/;

export function curriculumTermSlots(durationYears: number, termsPerYear: number) {
  return levels.slice(0, durationYears).flatMap((level) => Array.from({ length: termsPerYear }, (_, index) => ({ level, term: (index === 0 ? "FIRST" : "SECOND") as SemesterTerm, name: index === 0 ? "First Semester" : "Second Semester" })));
}
export function provisionKey(curriculumId: string, level: AcademicLevel, term: SemesterTerm) { return `curriculum:${curriculumId}:${level}:${term}`; }

export function academicYearForLevel(academicYear: string, anchorLevel: AcademicLevel, targetLevel: AcademicLevel) {
  const match = academicYear.match(academicYearPattern);
  if (!match) throw new Error("Academic year must use the format 2025/2026.");

  const offset = levels.indexOf(targetLevel) - levels.indexOf(anchorLevel);
  if (offset === 0) return academicYear;

  return `${Number(match[1]) + offset}/${Number(match[2]) + offset}`;
}

export async function ensureProgrammeCurriculum(input: { college: string; programme: string; department: string; version: string }) {
  const importedCurriculum = await prisma.programmeCurriculum.findFirst({
    where: { college: input.college, programme: input.programme, department: input.department, version: input.version, isPublished: true },
  });
  if (importedCurriculum) return importedCurriculum;
  const definition = findProgrammeCurriculum(input);
  if (!definition) throw new Error("No published curriculum version is available for this programme.");
  const curriculum = await prisma.programmeCurriculum.upsert({
    where: { college_programme_version: { college: input.college, programme: input.programme, version: input.version } },
    create: { college: input.college, department: input.department, programme: input.programme, version: input.version, durationYears: definition.durationYears, termsPerYear: definition.termsPerYear, source: definition.source }, update: {},
  });
  for (const slot of curriculumTermSlots(definition.durationYears, definition.termsPerYear)) {
    const template = knustCurricula.find((item) => item.college === input.college && item.program === input.programme && item.department === input.department && item.version === input.version && item.level === slot.level && item.semester === slot.name);
    const term = await prisma.programmeCurriculumTerm.upsert({ where: { curriculumId_level_term: { curriculumId: curriculum.id, level: slot.level, term: slot.term } }, create: { curriculumId: curriculum.id, level: slot.level, term: slot.term, name: slot.name, source: template?.source }, update: {} });
    for (const course of template?.courses ?? []) await prisma.programmeCurriculumCourse.upsert({ where: { curriculumTermId_courseCode: { curriculumTermId: term.id, courseCode: course.code } }, create: { curriculumTermId: term.id, courseCode: course.code, courseName: course.name, creditHours: course.creditHours, isApproved: true, source: template?.source }, update: {} });
  }
  return curriculum;
}

export async function getPublishedCurriculumVersions(input: { college: string; programme: string; department?: string }) {
  const imported = await prisma.programmeCurriculum.findMany({
    where: { college: input.college, programme: input.programme, isPublished: true, ...(input.department ? { department: input.department } : {}) },
    select: { version: true },
  });
  return [...new Set([...imported.map((item) => item.version), ...getCurriculumVersions(input)])].sort().reverse();
}

export async function provisionStudentSemesters(input: { userId: string; curriculumId: string; academicYear: string; activeLevel: AcademicLevel; cwa?: number }) {
  const curriculum = await prisma.programmeCurriculum.findUniqueOrThrow({ where: { id: input.curriculumId }, include: { terms: { include: { courses: true } } } });
  const semesters = [];
  for (const term of curriculum.terms) {
    const semester = await prisma.semester.upsert({ where: { ownerId_provisionKey: { ownerId: input.userId, provisionKey: provisionKey(curriculum.id, term.level, term.term) } }, create: { ownerId: input.userId, level: term.level, term: term.term, name: term.name, academicYear: academicYearForLevel(input.academicYear, input.activeLevel, term.level), cwa: input.cwa, curriculumId: curriculum.id, curriculumTermId: term.id, provisionKey: provisionKey(curriculum.id, term.level, term.term) }, update: {} });
    await prisma.semesterProfile.upsert({ where: { userId_semesterId: { userId: input.userId, semesterId: semester.id } }, create: { userId: input.userId, semesterId: semester.id, level: term.level, cwa: input.cwa }, update: {} });
    const excluded = new Set((await prisma.studentCourseExclusion.findMany({ where: { userId: input.userId, semesterId: semester.id }, select: { courseCode: true } })).map((item) => item.courseCode));
    for (const item of term.courses.filter((course) => course.isApproved && !excluded.has(course.courseCode))) {
      const course = await prisma.course.upsert({ where: { code: item.courseCode }, create: { code: item.courseCode, name: item.courseName, creditHours: item.creditHours, department: curriculum.department, level: term.level, approvalStatus: "OFFICIAL" }, update: {} });
      await prisma.enrollment.upsert({ where: { userId_courseId_semesterId: { userId: input.userId, courseId: course.id, semesterId: semester.id } }, create: { userId: input.userId, courseId: course.id, semesterId: semester.id, origin: "CURRICULUM_DEFAULT", sourceKey: `curriculum-course:${term.id}:${item.courseCode}` }, update: {} });
    }
    semesters.push(semester);
  }
  return semesters;
}

export async function ensureDefaultGoals(userId: string, semesterId: string) {
  await prisma.goal.upsert({ where: { userId_semesterId_sourceKey: { userId, semesterId, sourceKey: "default-target-cwa" } }, create: { userId, semesterId, title: "Target CWA", category: "ACADEMIC", metric: "CWA", period: "SEMESTER", targetValue: 70, sourceKey: "default-target-cwa" }, update: {} });
  await prisma.goal.upsert({ where: { userId_semesterId_sourceKey: { userId, semesterId, sourceKey: "default-weekly-study-hours" } }, create: { userId, semesterId, title: "Weekly study hours", category: "STUDY_TIME", metric: "STUDY_MINUTES", period: "WEEKLY", targetValue: 600, sourceKey: "default-weekly-study-hours" }, update: {} });
}
