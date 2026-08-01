"use server";

import { revalidatePath } from "next/cache";

import { requireAppUser } from "@/features/auth/queries";
import {
  createStudyGroupSchema,
  deleteStudyGroupSchema,
  groupMembershipSchema,
  peerAnswerIdSchema,
  peerAnswerSchema,
  peerQuestionIdSchema,
  peerQuestionSchema,
  updateStudyGroupSchema,
} from "@/features/peers/schemas";
import { prisma } from "@/server/db";

function refreshPeers() {
  revalidatePath("/peers");
  revalidatePath("/dashboard");
}

async function getCohortSemesterIds(userId: string, semesterId: string) {
  const activeSemester = await prisma.semester.findFirst({
    where: { id: semesterId, ownerId: userId },
    select: { academicYear: true, level: true, term: true },
  });
  if (!activeSemester) throw new Error("Active semester not found in your workspace.");
  const semesters = await prisma.semester.findMany({
    where: {
      academicYear: activeSemester.academicYear,
      level: activeSemester.level,
      term: activeSemester.term,
    },
    select: { id: true },
  });
  return semesters.map((semester) => semester.id);
}
export async function createStudyGroup(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before creating a group.");

  const parsed = createStudyGroupSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    courseId: formData.get("courseId"),
    maxMembers: formData.get("maxMembers"),
    meetingAt: formData.get("meetingAt") || undefined,
    meetingPlace: formData.get("meetingPlace") || undefined,
  });

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      courseId: parsed.courseId,
    },
    select: { id: true },
  });
  if (!enrollment) throw new Error("Choose a course from your active semester.");

  await prisma.studyGroup.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      courseId: parsed.courseId,
      semesterId: appUser.activeSemesterId,
      ownerId: appUser.id,
      maxMembers: parsed.maxMembers,
      meetingAt: parsed.meetingAt ? new Date(parsed.meetingAt) : null,
      meetingPlace: parsed.meetingPlace,
      members: {
        create: {
          userId: appUser.id,
          role: "owner",
        },
      },
    },
  });

  refreshPeers();
}

export async function updateStudyGroup(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before updating a group.");

  const parsed = updateStudyGroupSchema.parse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    maxMembers: formData.get("maxMembers"),
    meetingAt: formData.get("meetingAt") || undefined,
    meetingPlace: formData.get("meetingPlace") || undefined,
  });

  const group = await prisma.studyGroup.findFirst({
    where: {
      id: parsed.groupId,
      ownerId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    include: {
      _count: { select: { members: true } },
      members: {
        select: {
          userId: true,
          user: {
            select: {
              notificationPreference: { select: { groupUpdates: true } },
            },
          },
        },
      },
    },
  });
  if (!group) throw new Error("Only the group owner can update this group.");
  if (parsed.maxMembers < group._count.members) {
    throw new Error("Member limit cannot be lower than the current member count.");
  }

  await prisma.studyGroup.update({
    where: { id: group.id },
    data: {
      name: parsed.name,
      description: parsed.description,
      maxMembers: parsed.maxMembers,
      meetingAt: parsed.meetingAt ? new Date(parsed.meetingAt) : null,
      meetingPlace: parsed.meetingPlace,
    },
  });

  const recipients = group.members.filter(
    (member) =>
      member.userId !== appUser.id &&
      member.user.notificationPreference?.groupUpdates !== false,
  );
  if (recipients.length) {
    const eventKey = `group-update:${group.id}:${Date.now()}`;
    await prisma.notification.createMany({
      data: recipients.map((member) => ({
        userId: member.userId,
        semesterId: appUser.activeSemesterId,
        title: "Study group updated",
        message: `${parsed.name} meeting details were updated.`,
        type: "GROUP" as const,
        actionUrl: "/peers?view=groups",
        sourceKey: `${eventKey}:${member.userId}`,
      })),
      skipDuplicates: true,
    });
  }
  refreshPeers();
}

export async function joinStudyGroup(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before joining a group.");
  const { groupId } = groupMembershipSchema.parse({ groupId: formData.get("groupId") });

  const cohortSemesterIds = await getCohortSemesterIds(appUser.id, appUser.activeSemesterId);

  const group = await prisma.studyGroup.findFirst({
    where: { id: groupId, semesterId: { in: cohortSemesterIds } },
    include: {
      members: {
        where: { userId: appUser.id },
        select: { id: true },
      },
      _count: { select: { members: true } },
    },
  });
  if (!group) throw new Error("Study group not found in the active semester.");
  if (group.members.length) return;
  if (group._count.members >= group.maxMembers) throw new Error("This study group is full.");

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      courseId: group.courseId,
    },
    select: { id: true },
  });
  if (!enrollment) throw new Error("You must be enrolled in the group course to join.");

  await prisma.studyGroupMember.create({
    data: { groupId, userId: appUser.id, role: "member" },
  });
  refreshPeers();
}

export async function leaveStudyGroup(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before leaving a group.");
  const { groupId } = groupMembershipSchema.parse({ groupId: formData.get("groupId") });
  const cohortSemesterIds = await getCohortSemesterIds(appUser.id, appUser.activeSemesterId);

  const group = await prisma.studyGroup.findFirst({
    where: { id: groupId, semesterId: { in: cohortSemesterIds } },
    select: { ownerId: true },
  });
  if (!group) throw new Error("Study group not found in the active semester.");
  if (group.ownerId === appUser.id) throw new Error("The group owner must delete the group instead.");

  await prisma.studyGroupMember.deleteMany({
    where: { groupId, userId: appUser.id },
  });
  refreshPeers();
}

export async function deleteStudyGroup(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting a group.");
  const { groupId } = deleteStudyGroupSchema.parse({ groupId: formData.get("groupId") });

  await prisma.studyGroup.deleteMany({
    where: {
      id: groupId,
      ownerId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
  });
  refreshPeers();
}

async function findAccessibleQuestion(
  questionId: string,
  userId: string,
  semesterId: string,
) {
  const cohortSemesterIds = await getCohortSemesterIds(userId, semesterId);
  return prisma.peerQuestion.findFirst({
    where: {
      id: questionId,
      semesterId: { in: cohortSemesterIds },
      OR: [
        { courseId: null },
        {
          course: {
            enrollments: {
              some: { userId, semesterId },
            },
          },
        },
      ],
    },
    select: { id: true, userId: true, title: true },
  });
}

export async function savePeerQuestion(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before posting questions.");

  const parsed = peerQuestionSchema.parse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    body: formData.get("body"),
    courseId: formData.get("courseId") || undefined,
  });

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        courseId: parsed.courseId,
      },
      select: { id: true },
    });
    if (!enrollment) throw new Error("Choose a course from your active semester.");
  }

  const data = {
    title: parsed.title,
    body: parsed.body,
    courseId: parsed.courseId ?? null,
  };

  if (parsed.id) {
    await prisma.peerQuestion.updateMany({
      where: {
        id: parsed.id,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
      data,
    });
  } else {
    await prisma.peerQuestion.create({
      data: {
        ...data,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
    });
  }
  refreshPeers();
}

export async function deletePeerQuestion(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting questions.");
  const { questionId } = peerQuestionIdSchema.parse({ questionId: formData.get("questionId") });

  await prisma.peerQuestion.deleteMany({
    where: {
      id: questionId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
  });
  refreshPeers();
}

export async function savePeerAnswer(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before answering questions.");

  const parsed = peerAnswerSchema.parse({
    id: formData.get("id") || undefined,
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  const question = await findAccessibleQuestion(
    parsed.questionId,
    appUser.id,
    appUser.activeSemesterId,
  );
  if (!question) throw new Error("Question not found for your active semester.");

  if (parsed.id) {
    await prisma.peerAnswer.updateMany({
      where: {
        id: parsed.id,
        questionId: question.id,
        userId: appUser.id,
      },
      data: { body: parsed.body },
    });
  } else {
    const answer = await prisma.peerAnswer.create({
      data: {
        questionId: question.id,
        userId: appUser.id,
        body: parsed.body,
      },
    });

    if (question.userId !== appUser.id) {
      const preference = await prisma.notificationPreference.findUnique({
        where: { userId: question.userId },
        select: { qaAnswers: true },
      });
      if (preference?.qaAnswers !== false) {
        await prisma.notification.create({
          data: {
            userId: question.userId,
            semesterId: appUser.activeSemesterId,
            title: "New answer to your question",
            message: `${appUser.fullName} answered: ${question.title}`,
            type: "GROUP",
            actionUrl: "/peers?view=qa",
            sourceKey: `qa-answer:${answer.id}`,
          },
        });
      }
    }
  }
  refreshPeers();
}

export async function deletePeerAnswer(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before deleting answers.");
  const parsed = peerAnswerIdSchema.parse({
    answerId: formData.get("answerId"),
    questionId: formData.get("questionId"),
  });

  const question = await findAccessibleQuestion(
    parsed.questionId,
    appUser.id,
    appUser.activeSemesterId,
  );
  if (!question) throw new Error("Question not found for your active semester.");

  await prisma.peerAnswer.deleteMany({
    where: {
      id: parsed.answerId,
      questionId: question.id,
      userId: appUser.id,
    },
  });
  refreshPeers();
}

export async function togglePeerQuestionVote(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) throw new Error("Set an active semester before voting.");
  const { questionId } = peerQuestionIdSchema.parse({ questionId: formData.get("questionId") });

  const question = await findAccessibleQuestion(
    questionId,
    appUser.id,
    appUser.activeSemesterId,
  );
  if (!question) throw new Error("Question not found for your active semester.");

  const existing = await prisma.peerQuestionVote.findUnique({
    where: {
      questionId_userId: {
        questionId,
        userId: appUser.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.peerQuestionVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.peerQuestionVote.create({
      data: { questionId, userId: appUser.id },
    });
  }
  refreshPeers();
}