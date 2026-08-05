import "server-only";

import { prisma } from "@/server/db";

export const archivedSemesterMessage = "Archived semesters are read-only. Reopen the semester before changing its academic records.";

export async function requireWritableSemester(userId: string, semesterId: string) {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, ownerId: userId },
    select: { id: true, isArchived: true },
  });

  if (!semester) {
    throw new Error("Semester not found in your workspace.");
  }

  if (semester.isArchived) {
    throw new Error(archivedSemesterMessage);
  }

  return semester;
}

export async function requireActiveWritableSemester(userId: string, semesterId: string | null | undefined) {
  if (!semesterId) {
    throw new Error("Set an active semester first.");
  }

  return requireWritableSemester(userId, semesterId);
}
