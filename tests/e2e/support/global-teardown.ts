import { rm } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { fixturePath, readE2eFixture } from "./fixture";
import { loadE2eEnvironment } from "./environment";

loadE2eEnvironment();

export default async function globalTeardown() {
  const fixture = await readE2eFixture().catch(() => null);
  if (!fixture) return;

  const prisma = new PrismaClient();
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const authUserIds = Object.values(fixture.users).map((user) => user.authUserId);
  const appUserIds = Object.values(fixture.users).flatMap((user) => user.appUserId ? [user.appUserId] : []);

  try {
    const storedMaterials = await prisma.courseMaterial.findMany({
      where: { uploadedBy: { in: appUserIds }, storagePath: { not: null } },
      select: { storagePath: true },
    });
    const storagePaths = storedMaterials.flatMap((material) => material.storagePath ? [material.storagePath] : []);
    for (let index = 0; index < storagePaths.length; index += 100) {
      await service.storage.from("course-materials").remove(storagePaths.slice(index, index + 100));
    }

    await prisma.user.deleteMany({ where: { authUserId: { in: authUserIds } } });
    await prisma.course.deleteMany({ where: { id: fixture.courseId } });
    await Promise.all(authUserIds.map((id) => service.auth.admin.deleteUser(id)));
  } finally {
    await prisma.$disconnect();
    await rm(fixturePath, { force: true });
  }
}
