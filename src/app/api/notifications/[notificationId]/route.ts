import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";

export async function PATCH(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const authUser = await getSupabaseUser();
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return Response.json({ error: "Onboarding required" }, { status: 409 });
  const { notificationId } = await context.params;
  const intent = (await request.json().catch(() => null))?.intent;
  if (!['read', 'dismiss'].includes(intent)) return Response.json({ error: "Invalid notification update" }, { status: 400 });
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: appUser.id },
    data: intent === 'read' ? { isRead: true, readAt: new Date(), status: 'READ' } : { isRead: true, readAt: new Date(), dismissedAt: new Date(), status: 'DISMISSED' },
  });
  return Response.json({ ok: true });
}
