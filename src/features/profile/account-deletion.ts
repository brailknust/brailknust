import "server-only";

import { removeCourseMaterialFiles } from "@/features/materials/storage";
import { createSupabaseServiceClient } from "@/server/supabase";
import { prisma } from "@/server/db";

const cleanupFailureMessage = "External account cleanup requires administrator retry.";

function storagePaths(value: unknown) {
  return Array.isArray(value)
    ? value.filter((path): path is string => typeof path === "string" && path.length > 0)
    : [];
}

function isMissingAuthUser(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "user_not_found" || /user.*not found/i.test(message);
}

export async function finalizeAccountDeletionCleanup(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: { not: null } },
    select: {
      id: true,
      authUserId: true,
      deletionStoragePaths: true,
      deletionStoragePending: true,
      deletionAuthPending: true,
    },
  });
  if (!user) return false;

  await prisma.user.update({
    where: { id: user.id },
    data: { deletionAttempts: { increment: 1 }, deletionLastError: null },
  });

  let storagePending = user.deletionStoragePending;
  let authPending = user.deletionAuthPending;
  let cleanupFailed = false;

  if (storagePending) {
    try {
      await removeCourseMaterialFiles(storagePaths(user.deletionStoragePaths));
      storagePending = false;
      await prisma.user.update({
        where: { id: user.id },
        data: { deletionStoragePending: false, deletionStoragePaths: [] },
      });
    } catch (error) {
      cleanupFailed = true;
      console.error("Account deletion storage cleanup failed", {
        userId: user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  if (authPending) {
    try {
      const serviceClient = createSupabaseServiceClient();
      const { error } = await serviceClient.auth.admin.deleteUser(user.authUserId);
      if (error && !isMissingAuthUser(error)) throw error;
      authPending = false;
      await prisma.user.update({
        where: { id: user.id },
        data: { deletionAuthPending: false },
      });
    } catch (error) {
      cleanupFailed = true;
      console.error("Account deletion Auth cleanup failed", {
        userId: user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  if (!cleanupFailed && !storagePending && !authPending) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionCompletedAt: new Date(),
        deletionLastError: null,
      },
    });
    return true;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { deletionLastError: cleanupFailureMessage },
  });
  return false;
}
