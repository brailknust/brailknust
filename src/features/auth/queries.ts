import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isConfiguredAdminEmail } from "@/features/auth/admin";
import { prisma } from "@/server/db";

export type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
};

export const getSupabaseUser = cache(async function getSupabaseUser(): Promise<SupabaseAuthUser | null> {
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

export async function getAppUserByAuthId(authUserId: string) {
  return prisma.user.findFirst({
    where: {
      authUserId,
      deletedAt: null,
    },
  });
}

async function promoteConfiguredAdmin(appUser: NonNullable<Awaited<ReturnType<typeof getAppUserByAuthId>>>) {
  if (appUser.role === "ADMIN") return appUser;

  return prisma.$transaction(async (tx) => {
    const promoted = await tx.user.update({
      where: { id: appUser.id },
      data: { role: "ADMIN" },
    });
    await tx.adminRoleAudit.create({
      data: { targetUserId: appUser.id, action: "BOOTSTRAPPED" },
    });
    return promoted;
  });
}

export async function getAppUserForAuthUser(authUser: SupabaseAuthUser) {
  const appUser = await getAppUserByAuthId(authUser.id);

  if (appUser) {
    return isConfiguredAdminEmail(authUser.email) ? promoteConfiguredAdmin(appUser) : appUser;
  }

  if (!isConfiguredAdminEmail(authUser.email) || !authUser.email) {
    return null;
  }

  const configuredAdmin = await prisma.user.findFirst({
    where: {
      email: { equals: authUser.email, mode: "insensitive" },
      deletedAt: null,
    },
  });

  return configuredAdmin ? promoteConfiguredAdmin(configuredAdmin) : null;
}

export async function requireAppUser() {
  const authUser = await requireSupabaseUser();
  const appUser = await getAppUserForAuthUser(authUser);

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
  const isConfiguredAdmin = isConfiguredAdminEmail(appUser.email);

  if (appUser.role === "ADMIN") return { authUser, appUser };

  if (isConfiguredAdmin) {
    const promoted = await promoteConfiguredAdmin(appUser);
    return { authUser, appUser: promoted };
  }

  redirect("/dashboard");
}
