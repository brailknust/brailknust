import "server-only";

import { dailyMessageLimit, isAiConfigured } from "@/features/ai/provider";
import { prisma } from "@/server/db";

export async function getAiChatPageData(
  userId: string,
  requestedConversationId?: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeSemesterId: true, activeSemester: true },
  });

  if (!user?.activeSemesterId) {
    return {
      activeSemester: null,
      profile: null,
      enrollments: [],
      conversations: [],
      selectedConversation: null,
      usedToday: 0,
      dailyLimit: dailyMessageLimit,
      isConfigured: isAiConfigured(),
    };
  }

  const semesterId = user.activeSemesterId;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, semesterId },
    include: { course: { select: { code: true, name: true } } },
    orderBy: { course: { code: "asc" } },
  });

  if (enrollments.length) {
    await prisma.aiConversation.createMany({
      data: enrollments.map((enrollment) => ({
        userId,
        semesterId,
        enrollmentId: enrollment.id,
        title: enrollment.course.name,
        isPinned: true,
      })),
      skipDuplicates: true,
    });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [profile, conversations, usedToday] = await Promise.all([
    prisma.semesterProfile.findUnique({
      where: { userId_semesterId: { userId, semesterId } },
    }),
    prisma.aiConversation.findMany({
      where: {
        userId,
        semesterId,
        enrollment: { userId, semesterId },
      },
      select: {
        id: true,
        title: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        enrollment: {
          select: {
            id: true,
            course: { select: { code: true, name: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: [
        { isPinned: "desc" },
        { enrollment: { course: { code: "asc" } } },
        { updatedAt: "desc" },
      ],
    }),
    prisma.aiMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: dayStart },
        conversation: { userId },
      },
    }),
  ]);

  const selectedId = conversations.some((item) => item.id === requestedConversationId)
    ? requestedConversationId
    : conversations[0]?.id;

  const selectedConversation = selectedId
    ? await prisma.aiConversation.findFirst({
        where: {
          id: selectedId,
          userId,
          semesterId,
          enrollment: { userId, semesterId },
        },
        include: {
          enrollment: {
            include: {
              course: true,
              courseTopics: {
                select: { id: true, title: true },
                orderBy: [{ sequence: "asc" }, { title: "asc" }],
              },
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  return {
    activeSemester: user.activeSemester,
    profile,
    enrollments,
    conversations,
    selectedConversation,
    usedToday,
    dailyLimit: dailyMessageLimit,
    isConfigured: isAiConfigured(),
  };
}
