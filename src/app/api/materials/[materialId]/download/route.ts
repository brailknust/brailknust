import { NextResponse } from "next/server";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { createCourseMaterialDownloadUrl } from "@/features/materials/storage";
import { prisma } from "@/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.json({ message: "Complete onboarding first." }, { status: 403 });

  const { materialId } = await params;
  const material = await prisma.courseMaterial.findFirst({
    where: {
      id: materialId,
      enrollment: { userId: appUser.id },
    },
    select: { storagePath: true },
  });
  if (!material?.storagePath) {
    return NextResponse.json({ message: "Material file not found." }, { status: 404 });
  }

  const signedUrl = await createCourseMaterialDownloadUrl(material.storagePath);
  return NextResponse.redirect(signedUrl);
}
