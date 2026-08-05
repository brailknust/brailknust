import { NextResponse } from "next/server";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export async function GET() {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.json({ message: "Account not found." }, { status: 404 });

  const rateLimit = await checkRateLimit({
    subject: appUser.id,
    action: "account-export",
    limit: 3,
    windowSeconds: 3600,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const [
    semesters,
    tasks,
    studyPlans,
    goals,
    weakAreas,
    conversations,
    diagnostics,
    peerQuestions,
    peerAnswers,
    groupsOwned,
    memberships,
    notifications,
    materials,
  ] = await prisma.$transaction([
    prisma.semester.findMany({
      where: { ownerId: appUser.id },
      include: {
        profiles: { where: { userId: appUser.id } },
        enrollments: { where: { userId: appUser.id }, include: { course: true } },
        assessments: { where: { userId: appUser.id }, orderBy: { createdAt: "asc" } },
        timetable: { where: { userId: appUser.id } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({ where: { userId: appUser.id }, orderBy: { createdAt: "asc" } }),
    prisma.studyPlan.findMany({ where: { userId: appUser.id }, include: { items: true }, orderBy: { createdAt: "asc" } }),
    prisma.goal.findMany({ where: { userId: appUser.id }, orderBy: { createdAt: "asc" } }),
    prisma.weakArea.findMany({ where: { userId: appUser.id }, orderBy: { updatedAt: "asc" } }),
    prisma.aiConversation.findMany({ where: { userId: appUser.id }, include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.diagnosticQuiz.findMany({ where: { userId: appUser.id }, include: { questions: { include: { attempts: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.peerQuestion.findMany({ where: { userId: appUser.id }, include: { answers: true }, orderBy: { createdAt: "asc" } }),
    prisma.peerAnswer.findMany({ where: { userId: appUser.id }, orderBy: { createdAt: "asc" } }),
    prisma.studyGroup.findMany({ where: { ownerId: appUser.id }, include: { members: true }, orderBy: { createdAt: "asc" } }),
    prisma.studyGroupMember.findMany({ where: { userId: appUser.id }, orderBy: { joinedAt: "asc" } }),
    prisma.notification.findMany({ where: { userId: appUser.id }, orderBy: { createdAt: "asc" } }),
    prisma.courseMaterial.findMany({
      where: { uploadedBy: appUser.id },
      include: { chunks: { select: { topic: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const body = JSON.stringify({
    format: "brail-account-export-v1",
    generatedAt: new Date().toISOString(),
    profile: {
      ...appUser,
      authUserId: undefined,
      role: undefined,
    },
    semesters,
    tasks,
    studyPlans,
    goals,
    weakAreas,
    conversations,
    diagnostics,
    peerQuestions,
    peerAnswers,
    groupsOwned,
    memberships,
    notifications,
    materials,
  }, null, 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="brail-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
