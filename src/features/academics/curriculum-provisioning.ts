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

type CurriculumRuleCourse = {
  courseCode: string;
  courseKind: "CORE" | "ELECTIVE";
  replacesCourseCode: string | null;
};

export function curriculumCourseIdentityCodes(course: Pick<CurriculumRuleCourse, "courseCode" | "replacesCourseCode">) {
  return [...new Set([course.courseCode, course.replacesCourseCode].filter((code): code is string => Boolean(code)))];
}

export function shouldAutoEnrollCurriculumCourse(course: CurriculumRuleCourse, excludedCodes: Set<string>) {
  return course.courseKind === "CORE"
    && curriculumCourseIdentityCodes(course).every((code) => !excludedCodes.has(code));
}

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
    include: { importedFrom: { select: { id: true } } },
  });
  const definition = findProgrammeCurriculum(input);
  if (importedCurriculum?.importedFrom || (!definition && importedCurriculum)) return importedCurriculum;
  if (!definition) throw new Error("No published curriculum version is available for this programme.");
  const curriculum = await prisma.programmeCurriculum.upsert({
    where: { college_programme_version: { college: input.college, programme: input.programme, version: input.version } },
    create: { college: input.college, department: input.department, programme: input.programme, version: input.version, durationYears: definition.durationYears, termsPerYear: definition.termsPerYear, source: definition.source }, update: {},
  });

  const slots = curriculumTermSlots(definition.durationYears, definition.termsPerYear);
  const slotsWithTemplate = slots.map((slot) => ({
    slot,
    template: knustCurricula.find((item) => item.college === input.college && item.program === input.programme && item.department === input.department && item.version === input.version && item.level === slot.level && item.semester === slot.name),
  }));
  const expectedCourseCount = slotsWithTemplate.reduce((sum, item) => sum + (item.template?.courses.length ?? 0), 0);

  // A fully provisioned curriculum is the common case for every student
  // after the first to onboard into it — checking that up front avoids
  // re-running the per-term, per-course provisioning below (up to ~150
  // sequential round trips over the full curriculum) on every onboarding
  // request. Refreshing already-provisioned term/course content when the
  // source data changes is the job of the dedicated `npm run
  // curriculum:sync` admin command, not implicit per-student work.
  const existingTerms = await prisma.programmeCurriculumTerm.findMany({
    where: { curriculumId: curriculum.id },
    include: { courses: true },
  });
  const existingCourseCount = existingTerms.reduce((sum, term) => sum + term.courses.length, 0);
  if (existingTerms.length === slots.length && existingCourseCount === expectedCourseCount) {
    return curriculum;
  }

  // First-time (or partial) provisioning: batch the remaining creates
  // into a handful of round trips instead of one upsert per term/course.
  const existingTermByKey = new Map(existingTerms.map((term) => [`${term.level}:${term.term}`, term]));
  const missingSlots = slotsWithTemplate.filter(({ slot }) => !existingTermByKey.has(`${slot.level}:${slot.term}`));

  const createdTerms = missingSlots.length
    ? await prisma.programmeCurriculumTerm.createManyAndReturn({
        data: missingSlots.map(({ slot, template }) => ({
          curriculumId: curriculum.id,
          level: slot.level,
          term: slot.term,
          name: slot.name,
          source: template?.source,
        })),
        skipDuplicates: true,
      })
    : [];

  const termByKey = new Map([
    ...existingTerms.map((term) => [`${term.level}:${term.term}`, term] as const),
    ...createdTerms.map((term) => [`${term.level}:${term.term}`, term] as const),
  ]);
  const existingCourseKeys = new Set(
    existingTerms.flatMap((term) => term.courses.map((course) => `${term.id}:${course.courseCode}`)),
  );
  const coursesToCreate = slotsWithTemplate.flatMap(({ slot, template }) => {
    const term = termByKey.get(`${slot.level}:${slot.term}`);
    if (!term || !template) return [];
    return template.courses
      .filter((course) => !existingCourseKeys.has(`${term.id}:${course.code}`))
      .map((course) => ({
        curriculumTermId: term.id,
        courseCode: course.code,
        courseName: course.name,
        creditHours: course.creditHours,
        courseKind: course.courseKind ?? "CORE",
        electiveGroup: course.electiveGroup,
        replacesCourseCode: course.replacesCourseCode,
        isApproved: true,
        source: template.source,
      }));
  });

  if (coursesToCreate.length) {
    await prisma.programmeCurriculumCourse.createMany({ data: coursesToCreate, skipDuplicates: true });
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

// Batched to keep onboarding fast and reliable against a real remote
// database. The original implementation issued one sequential round trip
// per semester, profile, exclusion lookup, course, and enrollment — over
// a full curriculum (8 terms, ~53 courses) that is 150+ round trips,
// harmless on localhost but easily enough to time out over real network
// latency to a remote database.
export async function provisionStudentSemesters(input: { userId: string; curriculumId: string; academicYear: string; activeLevel: AcademicLevel; cwa?: number }) {
  const curriculum = await prisma.programmeCurriculum.findUniqueOrThrow({ where: { id: input.curriculumId }, include: { terms: { include: { courses: true } } } });

  const termPlans = curriculum.terms.map((term) => ({
    term,
    provisionKey: provisionKey(curriculum.id, term.level, term.term),
    academicYear: academicYearForLevel(input.academicYear, input.activeLevel, term.level),
  }));

  await prisma.semester.createMany({
    data: termPlans.map(({ term, provisionKey: key, academicYear }) => ({
      ownerId: input.userId,
      level: term.level,
      term: term.term,
      name: term.name,
      academicYear,
      cwa: input.cwa,
      curriculumId: curriculum.id,
      curriculumTermId: term.id,
      provisionKey: key,
    })),
    skipDuplicates: true,
  });

  const semesters = await prisma.semester.findMany({
    where: { ownerId: input.userId, provisionKey: { in: termPlans.map((plan) => plan.provisionKey) } },
  });
  const semesterByProvisionKey = new Map(semesters.map((semester) => [semester.provisionKey, semester]));

  const approvedCourseTemplates = new Map<string, { name: string; creditHours: number; level: AcademicLevel }>();
  for (const term of curriculum.terms) {
    for (const course of term.courses) {
      if (course.isApproved && !approvedCourseTemplates.has(course.courseCode)) {
        approvedCourseTemplates.set(course.courseCode, { name: course.courseName, creditHours: course.creditHours, level: term.level });
      }
    }
  }
  const courseCodes = [...approvedCourseTemplates.keys()];

  const [, exclusions, existingCourses] = await Promise.all([
    prisma.semesterProfile.createMany({
      data: semesters.map((semester) => ({ userId: input.userId, semesterId: semester.id, level: semester.level, cwa: input.cwa })),
      skipDuplicates: true,
    }),
    prisma.studentCourseExclusion.findMany({
      where: { userId: input.userId, semesterId: { in: semesters.map((semester) => semester.id) } },
      select: { semesterId: true, courseCode: true },
    }),
    courseCodes.length
      ? prisma.course.findMany({ where: { code: { in: courseCodes } }, select: { id: true, code: true } })
      : Promise.resolve([]),
  ]);

  const excludedBySemester = new Map<string, Set<string>>();
  for (const exclusion of exclusions) {
    const set = excludedBySemester.get(exclusion.semesterId) ?? new Set<string>();
    set.add(exclusion.courseCode);
    excludedBySemester.set(exclusion.semesterId, set);
  }

  const existingCourseCodes = new Set(existingCourses.map((course) => course.code));
  const coursesToCreate = courseCodes
    .filter((code) => !existingCourseCodes.has(code))
    .map((code) => {
      const template = approvedCourseTemplates.get(code)!;
      return { code, name: template.name, creditHours: template.creditHours, department: curriculum.department, level: template.level, approvalStatus: "OFFICIAL" as const };
    });
  const createdCourses = coursesToCreate.length
    ? await prisma.course.createManyAndReturn({ data: coursesToCreate, skipDuplicates: true, select: { id: true, code: true } })
    : [];
  const courseIdByCode = new Map<string, string>([
    ...existingCourses.map((course) => [course.code, course.id] as const),
    ...createdCourses.map((course) => [course.code, course.id] as const),
  ]);

  const enrollmentsToCreate = curriculum.terms.flatMap((term) => {
    const semester = semesterByProvisionKey.get(provisionKey(curriculum.id, term.level, term.term));
    if (!semester) return [];
    const excluded = excludedBySemester.get(semester.id) ?? new Set<string>();
    return term.courses
      .filter((course) => course.isApproved && shouldAutoEnrollCurriculumCourse(course, excluded))
      .flatMap((course) => {
        const courseId = courseIdByCode.get(course.courseCode);
        if (!courseId) return [];
        return [{
          userId: input.userId,
          courseId,
          semesterId: semester.id,
          origin: "CURRICULUM_DEFAULT" as const,
          sourceKey: `curriculum-course:${term.id}:${course.courseCode}`,
        }];
      });
  });

  if (enrollmentsToCreate.length) {
    await prisma.enrollment.createMany({ data: enrollmentsToCreate, skipDuplicates: true });
  }

  return semesters;
}

export async function ensureDefaultGoals(userId: string, semesterId: string) {
  await prisma.goal.upsert({ where: { userId_semesterId_sourceKey: { userId, semesterId, sourceKey: "default-target-cwa" } }, create: { userId, semesterId, title: "Target CWA", category: "ACADEMIC", metric: "CWA", period: "SEMESTER", targetValue: 70, sourceKey: "default-target-cwa" }, update: {} });
  await prisma.goal.upsert({ where: { userId_semesterId_sourceKey: { userId, semesterId, sourceKey: "default-weekly-study-hours" } }, create: { userId, semesterId, title: "Weekly study hours", category: "STUDY_TIME", metric: "STUDY_MINUTES", period: "WEEKLY", targetValue: 600, sourceKey: "default-weekly-study-hours" }, update: {} });
}
