import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";
import { runNotificationCronBatch } from "@/features/notifications/cron";

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
  return NextResponse.json(await runNotificationCronBatch(cursor));
}
