import "server-only";

import { prisma } from "@/server/db";

export async function getProfileSemesters(userId: string) {
  const semesters = await prisma.semester.findMany({
    where: { ownerId: userId },
    include: {
      profiles: {
        where: { userId },
      },
      enrollments: {
        where: { userId },
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ academicYear: "desc" }, { name: "asc" }],
  });

  return semesters
    .filter((semester) => semester.profiles.length > 0 || semester.enrollments.length > 0)
    .map((semester) => ({
      id: semester.id,
      name: semester.name,
      academicYear: semester.academicYear,
      profile: semester.profiles[0] ?? null,
    }));
}
