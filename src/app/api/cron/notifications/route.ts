import { NextResponse } from "next/server";

import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";
import { serverEnv } from "@/lib/env";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";
import { reconcileAcademicTracking } from "@/features/tracking/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!serverEnv.CRON_SECRET) {
    return NextResponse.json({ error: "Notification scheduler is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  const users = await prisma.user.findMany({
    where: { activeSemesterId: { not: null } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 100,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let synced = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await syncNotificationsForUser(user.id, true);
      const active = await prisma.user.findUnique({ where: { id: user.id }, select: { activeSemesterId: true } });
      if (active?.activeSemesterId) await syncGoalProgressSnapshots(user.id, active.activeSemesterId);
      if (active?.activeSemesterId) await reconcileAcademicTracking(user.id, active.activeSemesterId);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error("Notification sync failed", { userId: user.id, error });
    }
  }

  // Retention cleanup is deliberately limited to terminal historical records.
  await prisma.notification.deleteMany({
    where: { status: { in: ["READ", "DISMISSED", "EXPIRED"] }, createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
  });

  return NextResponse.json({ processed: users.length, synced, failed, nextCursor: users.length === 100 ? users.at(-1)?.id ?? null : null });
}
