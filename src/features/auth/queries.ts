import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/server/db";

export const getSupabaseUser = cache(async function getSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    user_metadata: {
      full_name:
        claims.user_metadata &&
        typeof claims.user_metadata === "object" &&
        "full_name" in claims.user_metadata &&
        typeof claims.user_metadata.full_name === "string"
          ? claims.user_metadata.full_name
          : undefined,
      avatar_url:
        claims.user_metadata &&
        typeof claims.user_metadata === "object" &&
        "avatar_url" in claims.user_metadata &&
        typeof claims.user_metadata.avatar_url === "string"
          ? claims.user_metadata.avatar_url
          : undefined,
    },
  };
});

export async function requireSupabaseUser() {
  const user = await getSupabaseUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export const getAppUserByAuthId = cache(async function getAppUserByAuthId(authUserId: string) {
  return prisma.user.findFirst({
    where: {
      authUserId,
      deletedAt: null,
    },
  });
});

export async function requireAppUser() {
  const authUser = await requireSupabaseUser();
  const appUser = await getAppUserByAuthId(authUser.id);

  if (!appUser) {
    redirect("/onboarding");
  }

  return {
    authUser,
    appUser,
  };
}

export async function requireAdmin() {
  const { authUser, appUser } = await requireAppUser();
  const configuredAdmins = new Set(
    (serverEnv.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const isConfiguredAdmin = configuredAdmins.has(appUser.email.toLowerCase());

  if (appUser.role === "ADMIN") return { authUser, appUser };

  const adminCount = isConfiguredAdmin
    ? await prisma.user.count({ where: { role: "ADMIN" } })
    : 1;

  if (isConfiguredAdmin && adminCount === 0) {
    const promoted = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: appUser.id },
        data: { role: "ADMIN" },
      });
      await tx.adminRoleAudit.create({
        data: { targetUserId: appUser.id, action: "BOOTSTRAPPED" },
      });
      return user;
    });
    return { authUser, appUser: promoted };
  }

  redirect("/dashboard");
}
