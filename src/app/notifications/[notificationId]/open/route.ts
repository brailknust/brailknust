import { NextResponse } from "next/server";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";

type OpenNotificationRouteProps = {
  params: Promise<{ notificationId: string }>;
};

export async function GET(request: Request, { params }: OpenNotificationRouteProps) {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.redirect(new URL("/login", request.url));

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.redirect(new URL("/onboarding", request.url));

  const { notificationId } = await params;
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: appUser.id },
    select: { id: true, actionUrl: true },
  });
  if (!notification) return NextResponse.redirect(new URL("/notifications", request.url));

  await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  });

  const target =
    notification.actionUrl?.startsWith("/") && !notification.actionUrl.startsWith("//")
      ? notification.actionUrl
      : "/notifications";
  return NextResponse.redirect(new URL(target, request.url));
}
