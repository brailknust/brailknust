"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/features/auth/queries";
import {
  createCourseSchema,
  createEnrollmentSchema,
  createSemesterSchema,
  createTimetableBlockSchema,
  activeSemesterSchema,
  deleteSemesterSchema,
  deleteEnrollmentSchema,
  enrollmentPerformanceSchema,
  semesterArchiveSchema,
  semesterProfileSchema,
  weakAreaSchema,
  deleteWeakAreaSchema,
} from "@/features/academics/schemas";
import { requireWritableSemester } from "@/features/academics/semester-state";
import { parseAccraDate } from "@/features/academics/time";
import { prisma } from "@/server/db";

function optionalDate(value?: string) {
  return parseAccraDate(value);
}

function timeOfDay(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function timeMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function overlaps(start: number, end: number, existingStart: number, existingEnd: number) {
  return start < existingEnd && end > existingStart;
}

export async function createSemester(formData: FormData) {
  const { appUser } = await requireAppUser();

  const [level, name] = String(formData.get("slot") ?? "").split("|");
  const parsed = createSemesterSchema.parse({
    name,
    academicYear: formData.get("academicYear"),
    level,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  const term = parsed.name === "First Semester" ? "FIRST" : "SECOND";
  const existingSemester = await prisma.semester.findFirst({
    where: { ownerId: appUser.id, level: parsed.level, term, isCustom: true },
    select: { id: true },
  });

  if (existingSemester) {
    throw new Error(`${parsed.level.replace("LEVEL_", "Level ")} - ${parsed.name} already exists.`);
  }

  const semesterCount = await prisma.semester.count({ where: { ownerId: appUser.id } });
  const shouldActivate = parsed.isActive || semesterCount === 0;

  let semester;
  try {
    semester = await prisma.semester.create({
      data: {
        ownerId: appUser.id,
        level: parsed.level,
        term,
        name: parsed.name,
        academicYear: parsed.academicYear,
        cwa: shouldActivate ? appUser.cwa : undefined,
        startDate: optionalDate(parsed.startDate),
        endDate: optionalDate(parsed.endDate),
        isActive: shouldActivate,
        isCustom: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`${parsed.level.replace("LEVEL_", "Level ")} - ${parsed.name} already exists.`);
    }
    throw error;
  }

  await prisma.semesterProfile.create({
    data: {
      userId: appUser.id,
      semesterId: semester.id,
      level: parsed.level,
      cwa: semester.cwa,
    },
  });

  if (shouldActivate) {
    await prisma.user.update({
      where: { id: appUser.id },
      data: { activeSemesterId: semester.id, level: parsed.level, cwa: semester.cwa },
    });
  }

  revalidatePath("/academics");
  revalidatePath("/dashboard");
}

export async function createCourse(formData: FormData) {
  const { appUser } = await requireAppUser();

  const parsed = createCourseSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    creditHours: formData.get("creditHours") || undefined,
    department: formData.get("department") || undefined,
    level: formData.get("level") || undefined,
    description: formData.get("description") || undefined,
  });

  const existing = await prisma.course.findUnique({
    where: { code: parsed.code },
    select: { approvalStatus: true, createdById: true },
  });
  if (existing && existing.approvalStatus !== "OFFICIAL" && existing.createdById !== appUser.id) {
    throw new Error("This course code is already awaiting administrator review.");
  }
  if (!existing) {
    await prisma.course.create({
      data: { ...parsed, approvalStatus: "PENDING", createdById: appUser.id },
    });
  }

  revalidatePath("/academics");
  revalidatePath("/dashboard");
}

export async function createEnrollment(formData: FormData) {
  const { appUser } = await requireAppUser();

  const parsed = createEnrollmentSchema.parse({
    courseId: formData.get("courseId"),
    semesterId: formData.get("semesterId"),
    lecturer: formData.get("lecturer") || undefined,
  });

  const semester = await prisma.semester.findFirst({
    where: { id: parsed.semesterId, ownerId: appUser.id },
    select: { id: true, isArchived: true },
  });
  if (!semester) throw new Error("Semester not found in your workspace.");
  if (semester.isArchived) throw new Error("Archived semesters are read-only. Reopen the semester before enrolling in courses.");

  const course = await prisma.course.findFirst({
    where: {
      id: parsed.courseId,
      OR: [{ approvalStatus: "OFFICIAL" }, { createdById: appUser.id }],
    },
    select: { id: true },
  });
  if (!course) throw new Error("Course not available in your workspace.");

  await prisma.enrollment.upsert({
    where: {
      userId_courseId_semesterId: {
        userId: appUser.id,
        courseId: parsed.courseId,
        semesterId: parsed.semesterId,
      },
    },
    create: {
      userId: appUser.id,
      courseId: parsed.courseId,
      semesterId: parsed.semesterId,
      lecturer: parsed.lecturer,
    },
    update: {
      lecturer: parsed.lecturer,
    },
  });

  await prisma.semesterProfile.upsert({
    where: {
      userId_semesterId: {
        userId: appUser.id,
        semesterId: parsed.semesterId,
      },
    },
    create: {
      userId: appUser.id,
      semesterId: parsed.semesterId,
    },
    update: {},
  });

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${parsed.semesterId}`);
  revalidatePath("/dashboard");
}

export async function createTimetableBlock(formData: FormData) {
  const { appUser } = await requireAppUser();

  const parsed = createTimetableBlockSchema.parse({
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId") || undefined,
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    venue: formData.get("venue") || undefined,
  });

  const semester = await prisma.semester.findFirst({
    where: { id: parsed.semesterId, ownerId: appUser.id },
    select: { id: true, isArchived: true },
  });
  if (!semester) throw new Error("Semester not found in your workspace.");
  if (semester.isArchived) throw new Error("Archived semesters are read-only. Reopen the semester before editing the timetable.");

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
      select: { id: true },
    });

    if (!enrollment) throw new Error("Select a course from this semester.");
  }

  const startTime = timeOfDay(parsed.startTime);
  const endTime = timeOfDay(parsed.endTime);
  const existingBlocks = await prisma.timetableBlock.findMany({
    where: { userId: appUser.id, semesterId: parsed.semesterId, dayOfWeek: parsed.dayOfWeek },
    select: { startTime: true, endTime: true },
  });
  const start = timeMinutes(startTime);
  const end = timeMinutes(endTime);
  if (existingBlocks.some((block) => overlaps(start, end, timeMinutes(block.startTime), timeMinutes(block.endTime)))) {
    throw new Error("This timetable block overlaps with an existing block.");
  }

  await prisma.timetableBlock.create({
    data: {
      userId: appUser.id,
      semesterId: parsed.semesterId,
      courseId: parsed.courseId,
      dayOfWeek: parsed.dayOfWeek,
      startTime,
      endTime,
      venue: parsed.venue,
      isBusy: true,
    },
  });

  revalidatePath("/academics");
  revalidatePath("/dashboard");
}

export async function updateSemesterProfile(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = semesterProfileSchema.parse({
    semesterId: formData.get("semesterId"),
    level: formData.get("level") || undefined,
    cwa: formData.get("cwa") || undefined,
  });

  const semester = await prisma.semester.findFirst({
    where: { id: parsed.semesterId, ownerId: appUser.id },
  });
  if (!semester) throw new Error("Semester not found in your workspace.");
  if (semester.isArchived) throw new Error("Archived semesters are read-only. Reopen the semester before editing CWA.");

  const level = parsed.level ?? semester.level;
  const conflictingSlot = await prisma.semester.findFirst({
    where: { ownerId: appUser.id, level, term: semester.term, isCustom: semester.isCustom },
    select: { id: true },
  });
  if (conflictingSlot && conflictingSlot.id !== semester.id) {
    throw new Error(`${level.replace("LEVEL_", "Level ")} - ${semester.name} already exists.`);
  }

  await prisma.$transaction([
    prisma.semester.update({
      where: { id: semester.id },
      data: { level, cwa: parsed.cwa },
    }),
    prisma.semesterProfile.upsert({
      where: { userId_semesterId: { userId: appUser.id, semesterId: semester.id } },
      create: { userId: appUser.id, semesterId: semester.id, level, cwa: parsed.cwa },
      update: { level, cwa: parsed.cwa },
    }),
  ]);

  if (parsed.cwa !== undefined) {
    await prisma.cwaSnapshot.create({ data: { userId: appUser.id, semesterId: semester.id, cwa: parsed.cwa } });
    await prisma.cwaEvidenceRecord.create({ data: { userId: appUser.id, semesterId: semester.id, mode: "OFFICIAL", value: parsed.cwa, evidence: "Student-entered verified result" } });
  }
  if (appUser.activeSemesterId === semester.id) {
    await prisma.user.update({ where: { id: appUser.id }, data: { cwa: parsed.cwa, level } });
  }

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${semester.id}`);
  revalidatePath("/dashboard");
}

export async function setActiveSemester(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = activeSemesterSchema.parse({ semesterId: formData.get("semesterId") });
  const semester = await prisma.semester.findFirst({
    where: { id: parsed.semesterId, ownerId: appUser.id },
  });
  if (!semester) throw new Error("Semester not found in your workspace.");
  if (semester.isArchived) throw new Error("Archived semesters cannot be made active until they are reopened.");

  await prisma.user.update({
    where: { id: appUser.id },
    data: { activeSemesterId: semester.id, cwa: semester.cwa, level: semester.level },
  });

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${semester.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function deleteSemester(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = deleteSemesterSchema.parse({ semesterId: formData.get("semesterId") });

  await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.findFirst({
      where: { id: parsed.semesterId, ownerId: appUser.id },
      select: { id: true },
    });
    if (!semester) throw new Error("Semester not found in your workspace.");

    await tx.semester.delete({ where: { id: semester.id } });

    const remaining = await tx.semester.findMany({
      where: { ownerId: appUser.id },
      select: { id: true, cwa: true, level: true },
      orderBy: [{ academicYear: "desc" }, { level: "desc" }, { term: "desc" }],
      take: 2,
    });

    if (remaining.length === 1) {
      await tx.user.update({
        where: { id: appUser.id },
        data: {
          activeSemesterId: remaining[0].id,
          cwa: remaining[0].cwa,
          level: remaining[0].level,
        },
      });
    } else if (appUser.activeSemesterId === semester.id) {
      await tx.user.update({
        where: { id: appUser.id },
        data: { activeSemesterId: null, cwa: null },
      });
    }
  });

  revalidatePath("/academics");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  redirect("/academics");
}

export async function archiveSemester(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = semesterArchiveSchema.parse({ semesterId: formData.get("semesterId") });

  await prisma.$transaction(async (tx) => {
    const semester = await tx.semester.findFirst({
      where: { id: parsed.semesterId, ownerId: appUser.id },
      select: { id: true },
    });
    if (!semester) throw new Error("Semester not found in your workspace.");

    await tx.semester.update({
      where: { id: semester.id },
      data: { isArchived: true, archivedAt: new Date(), isActive: false },
    });

    if (appUser.activeSemesterId === semester.id) {
      await tx.user.update({
        where: { id: appUser.id },
        data: {
          activeSemesterId: null,
          cwa: null,
          level: appUser.level,
        },
      });
    }
  });

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${parsed.semesterId}`);
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function reopenSemester(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = semesterArchiveSchema.parse({ semesterId: formData.get("semesterId") });

  const result = await prisma.semester.updateMany({
    where: { id: parsed.semesterId, ownerId: appUser.id },
    data: { isArchived: false, archivedAt: null },
  });
  if (!result.count) throw new Error("Semester not found in your workspace.");

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${parsed.semesterId}`);
}

export async function deleteEnrollment(formData: FormData) {
  const { appUser } = await requireAppUser();

  const parsed = deleteEnrollmentSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    semesterId: formData.get("semesterId"),
  });
  await requireWritableSemester(appUser.id, parsed.semesterId);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: parsed.enrollmentId, userId: appUser.id, semesterId: parsed.semesterId },
    include: { course: { select: { code: true } } },
  });
  if (enrollment?.origin === "CURRICULUM_DEFAULT") {
    await prisma.studentCourseExclusion.upsert({
      where: { userId_semesterId_courseCode: { userId: appUser.id, semesterId: parsed.semesterId, courseCode: enrollment.course.code } },
      create: { userId: appUser.id, semesterId: parsed.semesterId, courseCode: enrollment.course.code },
      update: {},
    });
  }
  await prisma.enrollment.deleteMany({
    where: {
      id: parsed.enrollmentId,
      userId: appUser.id,
      semesterId: parsed.semesterId,
    },
  });

  revalidatePath("/academics");
  revalidatePath(`/academics/semesters/${parsed.semesterId}`);
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}

export async function updateEnrollmentPerformance(formData: FormData) {
  const { appUser } = await requireAppUser();

  const parsed = enrollmentPerformanceSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    lecturer: formData.get("lecturer") || undefined,
    currentGrade: formData.get("currentGrade") || undefined,
    attendance: formData.get("attendance") || undefined,
    confidenceScore: formData.get("confidenceScore") || undefined,
  });
  await requireWritableSemester(appUser.id, parsed.semesterId);

  await prisma.enrollment.updateMany({
    where: {
      id: parsed.enrollmentId,
      userId: appUser.id,
      semesterId: parsed.semesterId,
      courseId: parsed.courseId,
    },
    data: {
      lecturer: parsed.lecturer,
      currentGrade: parsed.currentGrade,
      attendance: parsed.attendance,
      confidenceScore: parsed.confidenceScore,
    },
  });

  revalidatePath(`/academics/semesters/${parsed.semesterId}`);
  revalidatePath(`/academics/semesters/${parsed.semesterId}/courses/${parsed.courseId}`);
  revalidatePath("/academics");
}


export async function saveWeakArea(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = weakAreaSchema.parse({
    id: formData.get("id") || undefined,
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
    topic: formData.get("topic"),
    weaknessScore: formData.get("weaknessScore") || undefined,
    detectedFrom: formData.get("detectedFrom") || undefined,
    recommendation: formData.get("recommendation") || undefined,
  });

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
    select: { id: true },
  });
  if (!enrollment) throw new Error("Course enrollment not found for this semester.");
  await requireWritableSemester(appUser.id, parsed.semesterId);

  if (parsed.id) {
    await prisma.weakArea.updateMany({
      where: { id: parsed.id, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
      data: {
        topic: parsed.topic,
        weaknessScore: parsed.weaknessScore,
        detectedFrom: parsed.detectedFrom,
        recommendation: parsed.recommendation,
      },
    });
  } else {
    await prisma.weakArea.create({
      data: {
        userId: appUser.id,
        semesterId: parsed.semesterId,
        courseId: parsed.courseId,
        topic: parsed.topic,
        weaknessScore: parsed.weaknessScore,
        detectedFrom: parsed.detectedFrom,
        recommendation: parsed.recommendation,
      },
    });
  }

  revalidatePath('/academics/semesters/' + parsed.semesterId + '/courses/' + parsed.courseId);
  revalidatePath("/performance");
}

export async function deleteWeakArea(formData: FormData) {
  const { appUser } = await requireAppUser();
  const parsed = deleteWeakAreaSchema.parse({
    id: formData.get("id"),
    semesterId: formData.get("semesterId"),
    courseId: formData.get("courseId"),
  });
  await requireWritableSemester(appUser.id, parsed.semesterId);

  await prisma.weakArea.deleteMany({
    where: { id: parsed.id, userId: appUser.id, semesterId: parsed.semesterId, courseId: parsed.courseId },
  });

  revalidatePath('/academics/semesters/' + parsed.semesterId + '/courses/' + parsed.courseId);
  revalidatePath("/performance");
}
