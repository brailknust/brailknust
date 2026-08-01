"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findCurriculumTemplate } from "@/data/curricula";
import { findKnustProgramme } from "@/data/knust-academic-hierarchy";
import { requireAppUser, requireSupabaseUser } from "@/features/auth/queries";
import { profileSchema, updateProfileSchema } from "@/features/profile/schemas";
import { prisma } from "@/server/db";

function normalizeProgrammeName(programme: FormDataEntryValue | null) {
  return programme === "BSc Computer Engineering" ? "Computer Engineering" : programme;
}

export async function completeProfile(formData: FormData) {
  const authUser = await requireSupabaseUser();

  const parsed = profileSchema.parse({
    fullName: formData.get("fullName"),
    studentId: formData.get("studentId"),
    college: formData.get("college"),
    programme: normalizeProgrammeName(formData.get("programme")),
    semesterName: formData.get("semesterName"),
    academicYear: formData.get("academicYear"),
    level: formData.get("level"),
    cwa: formData.get("cwa") || undefined,
  });
  const programme = findKnustProgramme(parsed.college, parsed.programme);
  if (!programme) throw new Error("Select a valid KNUST programme.");

  const appUser = await prisma.user.upsert({
    where: { authUserId: authUser.id },
    create: {
      authUserId: authUser.id,
      email: authUser.email ?? "",
      fullName: parsed.fullName,
      studentId: parsed.studentId,
      college: parsed.college,
      programme: parsed.programme,
      department: programme.department,
      level: parsed.level,
      cwa: parsed.cwa,
      avatarUrl: authUser.user_metadata.avatar_url,
    },
    update: {
      email: authUser.email ?? "",
      fullName: parsed.fullName,
      studentId: parsed.studentId,
      college: parsed.college,
      programme: parsed.programme,
      department: programme.department,
      level: parsed.level,
      cwa: parsed.cwa,
      avatarUrl: authUser.user_metadata.avatar_url,
    },
  });

  const term = parsed.semesterName === "First Semester" ? "FIRST" : "SECOND";
  const activeSemester = await prisma.semester.upsert({
    where: {
      ownerId_level_term: { ownerId: appUser.id, level: parsed.level, term },
    },
    create: {
      ownerId: appUser.id,
      level: parsed.level,
      term,
      name: parsed.semesterName,
      academicYear: parsed.academicYear,
      cwa: parsed.cwa,
      isActive: true,
    },
    update: {
      academicYear: parsed.academicYear,
      cwa: parsed.cwa,
      isActive: true,
    },
  });

  await prisma.user.update({
    where: { id: appUser.id },
    data: { activeSemesterId: activeSemester.id },
  });

  await prisma.semesterProfile.upsert({
    where: { userId_semesterId: { userId: appUser.id, semesterId: activeSemester.id } },
    create: { userId: appUser.id, semesterId: activeSemester.id, level: parsed.level, cwa: parsed.cwa },
    update: { level: parsed.level, cwa: parsed.cwa },
  });

  if (parsed.cwa !== undefined) {
    await prisma.cwaSnapshot.create({ data: { userId: appUser.id, semesterId: activeSemester.id, cwa: parsed.cwa } });
  }

  const curriculum = findCurriculumTemplate({
    college: parsed.college,
    programme: parsed.programme,
    department: programme.department,
    level: parsed.level,
    semester: parsed.semesterName,
  });

  if (curriculum) {
    const exclusions = await prisma.programmeCourseExclusion.findMany({
      where: {
        programme: curriculum.program,
        level: curriculum.level,
        semester: curriculum.semester,
      },
      select: { courseCode: true },
    });
    const excludedCourseCodes = new Set(exclusions.map((item) => item.courseCode));
    for (const course of curriculum.courses.filter((item) => !excludedCourseCodes.has(item.code))) {
      const savedCourse = await prisma.course.upsert({
        where: { code: course.code },
        create: { code: course.code, name: course.name, creditHours: course.creditHours, department: programme.department, level: parsed.level },
        update: { name: course.name, creditHours: course.creditHours, department: programme.department, level: parsed.level },
      });
      await prisma.enrollment.upsert({
        where: { userId_courseId_semesterId: { userId: appUser.id, courseId: savedCourse.id, semesterId: activeSemester.id } },
        create: { userId: appUser.id, courseId: savedCourse.id, semesterId: activeSemester.id },
        update: {},
      });
    }
  }

  redirect("/dashboard");
}

export async function updateProfile(formData: FormData) {
  const { appUser, authUser } = await requireAppUser();

  const parsed = updateProfileSchema.parse({
    fullName: formData.get("fullName"),
    studentId: formData.get("studentId"),
    college: formData.get("college"),
    programme: normalizeProgrammeName(formData.get("programme")),
    level: formData.get("level"),
    activeSemesterId: formData.get("activeSemesterId") || undefined,
    cwa: formData.get("cwa") || undefined,
  });
  const programme = findKnustProgramme(parsed.college, parsed.programme);

  if (!programme) {
    throw new Error("Select a valid KNUST programme.");
  }

const selectedSemester = parsed.activeSemesterId
    ? await prisma.semester.findFirst({
        where: { id: parsed.activeSemesterId, ownerId: appUser.id },
        select: { id: true, level: true },
      })
    : null;
  if (parsed.activeSemesterId && !selectedSemester) {
    throw new Error("Select a valid active semester.");
  }

  await prisma.user.update({
    where: { id: appUser.id },
    data: {
      email: authUser.email ?? appUser.email,
      fullName: parsed.fullName,
      studentId: parsed.studentId,
      college: parsed.college,
      programme: parsed.programme,
      department: programme.department,
      level: parsed.level,
      cwa: parsed.cwa,
      activeSemesterId: parsed.activeSemesterId ?? null,
      avatarUrl: authUser.user_metadata.avatar_url ?? appUser.avatarUrl,
    },
  });

  if (parsed.activeSemesterId && selectedSemester) {
    await prisma.semester.update({ where: { id: selectedSemester.id }, data: { cwa: parsed.cwa } });
    await prisma.semesterProfile.upsert({
      where: {
        userId_semesterId: {
          userId: appUser.id,
          semesterId: parsed.activeSemesterId,
        },
      },
      create: {
        userId: appUser.id,
        semesterId: parsed.activeSemesterId,
        level: selectedSemester.level,
        cwa: parsed.cwa,
      },
      update: {
        level: selectedSemester.level,
        cwa: parsed.cwa,
      },
    });
  }

  if (parsed.activeSemesterId && parsed.cwa !== undefined) {
    await prisma.cwaSnapshot.create({ data: { userId: appUser.id, semesterId: parsed.activeSemesterId, cwa: parsed.cwa } });
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/academics");
  revalidatePath("/planner");
}
