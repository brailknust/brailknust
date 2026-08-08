import "server-only";

import { z } from "zod";

import { prisma } from "@/server/db";

export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["ios", "android"]),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

/**
 * Registers (or refreshes) an Expo push token for a device belonging to
 * `userId`. `token` is globally unique (Expo push tokens are per
 * install, not per user) — re-registering the same token just moves it to
 * the current user and bumps `lastSeenAt`, which correctly handles the
 * "different student logs into a shared/reinstalled device" case.
 */
export async function registerDeviceToken(userId: string, input: RegisterDeviceTokenInput) {
  await prisma.deviceToken.upsert({
    where: { token: input.token },
    create: { userId, token: input.token, platform: input.platform },
    update: { userId, platform: input.platform, lastSeenAt: new Date() },
  });
}
