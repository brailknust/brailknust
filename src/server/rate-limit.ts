import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

type RateLimitOptions = {
  subject: string;
  action: string;
  limit: number;
  windowSeconds: number;
};

export async function checkRateLimit(options: RateLimitOptions) {
  const windowMs = options.windowSeconds * 1_000;
  const now = Date.now();
  const bucketStart = new Date(Math.floor(now / windowMs) * windowMs);
  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      subject_action_bucketStart: {
        subject: options.subject,
        action: options.action,
        bucketStart,
      },
    },
    create: { subject: options.subject, action: options.action, bucketStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  if (bucket.count === 1) {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        subject: options.subject,
        bucketStart: { lt: new Date(now - 30 * 24 * 60 * 60 * 1_000) },
      },
    });
  }

  return {
    allowed: bucket.count <= options.limit,
    retryAfter: Math.max(1, Math.ceil((bucketStart.getTime() + windowMs - now) / 1_000)),
  };
}

export function rateLimitResponse(retryAfter: number) {
  const message = "Too many requests. Wait a moment and try again.";
  return NextResponse.json(
    { message, error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
