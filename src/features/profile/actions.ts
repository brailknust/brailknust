"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureDefaultGoals, ensureProgrammeCurriculum, getPublishedCurriculumVersions, provisionStudentSemesters } from "@/features/academics/curriculum-provisioning";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { findKnustProgramme } from "@/data/knust-academic-hierarchy";
import { requireAppUser, requireSupabaseUser } from "@/features/auth/queries";
import { profileSchema, updateProfileSchema } from "@/features/profile/schemas";
import { finalizeAccountDeletionCleanup } from "@/features/profile/account-deletion";
import { prisma } from "@/server/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/server/rate-limit";

function normalizeProgrammeName(programme: FormDataEntryValue | null) {
  return programme === "BSc Computer Engineering" ? "Computer Engineering" : programme;
}

export async function completeProfile(formData: FormData) {
  const authUser = await requireSupabaseUser();
  const deletedAccount = await prisma.user.findFirst({
    where: { authUserId: authUser.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (deletedAccount) throw new Error("This account has been deleted and cannot be restored through onboarding.");

  const parsed = profileSchema.parse({
    fullName: formData.get("fullName"),
    studentId: formData.get("studentId"),
    college: formData.get("college"),
    programme: normalizeProgrammeName(formData.get("programme")),
    curriculumVersion: formData.get("curriculumVersion") || undefined,
    semesterName: formData.get("semesterName"),
    academicYear: formData.get("academicYear"),
    level: formData.get("level"),
    cwa: formData.get("cwa") || undefined,
  });
  const programme = findKnustProgramme(parsed.college, parsed.programme);
  if (!programme) throw new Error("Select a valid KNUST programme.");
  const versions = await getPublishedCurriculumVersions({ college: parsed.college, programme: parsed.programme, department: programme.department });
  if (versions.length && (!parsed.curriculumVersion || !versions.includes(parsed.curriculumVersion))) throw new Error("Select a published curriculum version for this programme.");

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

  if (!parsed.curriculumVersion) throw new Error("A curriculum version is required before BRAIL can provision semesters.");
  const curriculum = await ensureProgrammeCurriculum({ college: parsed.college, programme: parsed.programme, department: programme.department, version: parsed.curriculumVersion });
  const semesters = await provisionStudentSemesters({ userId: appUser.id, curriculumId: curriculum.id, academicYear: parsed.academicYear, activeLevel: parsed.level, cwa: parsed.cwa });
  const term = parsed.semesterName === "First Semester" ? "FIRST" : "SECOND";
  const activeSemester = semesters.find((semester) => semester.level === parsed.level && semester.term === term);
  if (!activeSemester) throw new Error("That semester is not available in the selected curriculum.");

  await prisma.user.update({
    where: { id: appUser.id },
    data: { activeSemesterId: activeSemester.id },
  });

  if (parsed.cwa !== undefined) {
    await prisma.cwaSnapshot.create({ data: { userId: appUser.id, semesterId: activeSemester.id, cwa: parsed.cwa } });
  }

  await ensureDefaultGoals(appUser.id, activeSemester.id);
  await syncNotificationsForUser(appUser.id, true);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Safe recovery path for accounts created before curriculum provisioning existed. */
export async function provisionExistingUserCurriculum() {
  const { appUser } = await requireAppUser();
  if (!appUser.college || !appUser.programme || !appUser.department) throw new Error("Complete your academic profile before provisioning a curriculum.");
  const version = (await getPublishedCurriculumVersions({ college: appUser.college, programme: appUser.programme, department: appUser.department }))[0];
  if (!version) throw new Error("A published curriculum is not available for your programme yet.");
  const curriculum = await ensureProgrammeCurriculum({ college: appUser.college, programme: appUser.programme, department: appUser.department, version });
  const activeSemester = appUser.activeSemesterId
    ? await prisma.semester.findFirst({
        where: { id: appUser.activeSemesterId, ownerId: appUser.id },
        select: { academicYear: true, level: true },
      })
    : null;
  const academicYear = activeSemester?.academicYear ?? `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  await provisionStudentSemesters({ userId: appUser.id, curriculumId: curriculum.id, academicYear, activeLevel: activeSemester?.level ?? appUser.level ?? "LEVEL_100", cwa: appUser.cwa ? Number(appUser.cwa) : undefined });
  revalidatePath("/academics");
  revalidatePath("/dashboard");
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

export async function deleteAccount(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (String(formData.get("confirmation") ?? "").trim().toUpperCase() !== "DELETE") {
    throw new Error("Type DELETE to confirm account deletion.");
  }

  if (appUser.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", deletedAt: null } });
    if (adminCount <= 1) {
      throw new Error("Grant another administrator access before deleting the final administrator account.");
    }
  }

  const rateLimit = await checkRateLimit({
    subject: appUser.id,
    action: "account-delete",
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
  if (!rateLimit.allowed) {
    throw new Error("Too many account deletion attempts. Try again later.");
  }

  const materials = await prisma.courseMaterial.findMany({
    where: { uploadedBy: appUser.id, storagePath: { not: null } },
    select: { storagePath: true },
  });
  const materialStoragePaths = materials.flatMap((material) => material.storagePath ? [material.storagePath] : []);

  await prisma.$transaction(async (tx) => {
    await tx.peerQuestion.deleteMany({
      where: { userId: appUser.id, answers: { none: {} } },
    });
    const retainedQuestions = await tx.peerQuestion.findMany({
      where: { userId: appUser.id, answers: { some: {} } },
      select: { id: true, semesterId: true },
    });
    const retainedQuestionIds = retainedQuestions.map((question) => question.id);

    if (retainedQuestionIds.length) {
      const retainedSemesterIds = [...new Set(retainedQuestions.map((question) => question.semesterId))];

      await tx.peerQuestion.updateMany({
        where: { id: { in: retainedQuestionIds } },
        data: { courseId: null },
      });
      await tx.semester.deleteMany({
        where: { ownerId: appUser.id, id: { notIn: retainedSemesterIds } },
      });
      await Promise.all([
        tx.assessment.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.cwaSnapshot.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.enrollment.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.goal.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.notification.deleteMany({ where: { userId: appUser.id } }),
        tx.semesterProfile.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.studyPlan.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.task.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.timetableBlock.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
        tx.weakArea.deleteMany({ where: { userId: appUser.id, semesterId: { in: retainedSemesterIds } } }),
      ]);
      await tx.semester.updateMany({
        where: { id: { in: retainedSemesterIds }, ownerId: appUser.id },
        data: {
          name: "Archived peer discussion",
          cwa: null,
          startDate: null,
          endDate: null,
          isActive: false,
        },
      });
    } else {
      await tx.semester.deleteMany({ where: { ownerId: appUser.id } });
    }

    await Promise.all([
      tx.aiConversation.deleteMany({ where: { userId: appUser.id } }),
      tx.diagnosticAttempt.deleteMany({ where: { userId: appUser.id } }),
      tx.diagnosticQuiz.deleteMany({ where: { userId: appUser.id } }),
      tx.notification.deleteMany({ where: { userId: appUser.id } }),
      tx.notificationPreference.deleteMany({ where: { userId: appUser.id } }),
      tx.peerQuestionVote.deleteMany({ where: { userId: appUser.id } }),
      tx.studyGroupMember.deleteMany({ where: { userId: appUser.id } }),
      tx.studyGroup.deleteMany({ where: { ownerId: appUser.id } }),
      tx.topicMastery.deleteMany({ where: { userId: appUser.id } }),
      tx.resource.deleteMany({ where: { uploadedBy: appUser.id } }),
      tx.rateLimitBucket.deleteMany({ where: { subject: appUser.id } }),
    ]);
    await tx.course.updateMany({
      where: { createdById: appUser.id, approvalStatus: { not: "OFFICIAL" } },
      data: { approvalStatus: "REJECTED" },
    });
    await tx.user.update({
      where: { id: appUser.id },
      data: {
        role: "STUDENT",
        email: `deleted-${appUser.id}@brail.invalid`,
        fullName: "Deleted student",
        studentId: null,
        college: null,
        programme: null,
        department: null,
        level: null,
        cwa: null,
        activeSemesterId: null,
        avatarUrl: null,
        deletedAt: new Date(),
        deletionStoragePaths: materialStoragePaths,
        deletionStoragePending: materialStoragePaths.length > 0,
        deletionAuthPending: true,
        deletionAttempts: 0,
        deletionLastError: null,
        deletionCompletedAt: null,
      },
    });
  });

  await finalizeAccountDeletionCleanup(appUser.id);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login?accountDeleted=1");
}
