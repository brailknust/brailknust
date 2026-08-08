import { getAppUserByAuthId } from "@/features/auth/queries";
import { registerDeviceToken, registerDeviceTokenSchema } from "@/features/notifications/device-tokens";
import { getSupabaseUserFromRequest } from "@/lib/supabase/api-auth";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

// Called by the BRAIL mobile app after the user grants notification
// permission (see mobile/src/lib/notifications.ts). Bearer-token only in
// practice, but also works with the web app's cookie session since it uses
// the same auth resolver as every other route.
export async function POST(request: Request) {
  const authUser = await getSupabaseUserFromRequest(request);
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });

  const rateLimit = await checkRateLimit({
    subject: appUser.id,
    action: "device-token-register",
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const parsed = registerDeviceTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid device token payload" }, { status: 400 });
  }

  await registerDeviceToken(appUser.id, parsed.data);
  return Response.json({ ok: true });
}
