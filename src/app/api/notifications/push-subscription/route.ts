import { z } from "zod";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

// Web Push's own subscription shape: { endpoint, keys: { p256dh, auth } }.
// See https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/toJSON
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

// Called from the browser (BrowserAlertSettings) after pushManager.subscribe()
// succeeds, and again on unsubscribe. One row per browser/device — the same
// user can have several subscriptions (multiple browsers/devices).
export async function POST(request: Request) {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  const rateLimit = await checkRateLimit({
    subject: appUser.id,
    action: "push-subscription-register",
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: appUser.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    update: {
      userId: appUser.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      lastSeenAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid unsubscribe payload" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: appUser.id },
  });

  return Response.json({ ok: true });
}
