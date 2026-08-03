import "server-only";

import { dailyMessageLimit, isAiConfigured } from "@/features/ai/provider";
import { prisma } from "@/server/db";

function getConversationSummaries(userId: string, semesterId: string) {
  return prisma.aiConversation.findMany({
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
      { isPinned: "desc" as const },
      { enrollment: { course: { code: "asc" as const } } },
      { updatedAt: "desc" as const },
    ],
  });
}

export async function getAiChatPageData(
  userId: string,
  semesterId: string | null,
  requestedConversationId?: string,
) {
  if (!semesterId) {
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

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [activeSemester, enrollments, profile, initialConversations, usedToday] = await Promise.all([
    prisma.semester.findFirst({
      where: { id: semesterId, ownerId: userId },
    }),
    prisma.enrollment.findMany({
      where: { userId, semesterId },
      include: { course: { select: { code: true, name: true } } },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.semesterProfile.findUnique({
      where: { userId_semesterId: { userId, semesterId } },
    }),
    getConversationSummaries(userId, semesterId),
    prisma.aiMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: dayStart },
        conversation: { userId },
      },
    }),
  ]);

  const pinnedEnrollmentIds = new Set(
    initialConversations
      .filter((conversation) => conversation.isPinned)
      .map((conversation) => conversation.enrollment.id),
  );
  const missingPinnedConversations = enrollments.filter(
    (enrollment) => !pinnedEnrollmentIds.has(enrollment.id),
  );

  if (missingPinnedConversations.length) {
    await prisma.aiConversation.createMany({
      data: missingPinnedConversations.map((enrollment) => ({
        userId,
        semesterId,
        enrollmentId: enrollment.id,
        title: enrollment.course.name,
        isPinned: true,
      })),
      skipDuplicates: true,
    });
  }
  const conversations = missingPinnedConversations.length
    ? await getConversationSummaries(userId, semesterId)
    : initialConversations;

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
    activeSemester,
    profile,
    enrollments,
    conversations,
    selectedConversation,
    usedToday,
    dailyLimit: dailyMessageLimit,
    isConfigured: isAiConfigured(),
  };
}
