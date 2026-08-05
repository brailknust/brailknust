import { NextResponse } from "next/server";

import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";
import { serverEnv } from "@/lib/env";

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

  const users = await prisma.user.findMany({
    where: { activeSemesterId: { not: null } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 1_000,
  });

  let synced = 0;
  let failed = 0;
  for (const user of users) {
    try {
      await syncNotificationsForUser(user.id, true);
      synced += 1;
    } catch (error) {
      failed += 1;
      console.error("Notification sync failed", { userId: user.id, error });
    }
  }

  return NextResponse.json({ processed: users.length, synced, failed });
}
