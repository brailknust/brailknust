import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

type PeerFilters = {
  search?: string;
  courseId?: string;
};

export async function getPeersPageData(userId: string, filters: PeerFilters = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      activeSemesterId: true,
      activeSemester: true,
      programme: true,
    },
  });

  if (!user?.activeSemesterId) {
    return {
      activeSemester: null,
      profile: null,
      courses: [],
      groups: [],
      peers: [],
      questions: [],
    };
  }

  const semesterId = user.activeSemesterId;
  const cohortSemesters = await prisma.semester.findMany({
    where: {
      academicYear: user.activeSemester!.academicYear,
      level: user.activeSemester!.level,
      term: user.activeSemester!.term,
    },
    select: { id: true },
  });
  const cohortSemesterIds = cohortSemesters.map((semester) => semester.id);
  const [profile, enrollments, groups] = await Promise.all([
    prisma.semesterProfile.findUnique({
      where: { userId_semesterId: { userId, semesterId } },
    }),
    prisma.enrollment.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.studyGroup.findMany({
      where: { semesterId: { in: cohortSemesterIds } },
      include: {
        course: true,
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: { id: true, fullName: true, avatarUrl: true, programme: true },
            },
          },
        },
      },
      orderBy: [{ meetingAt: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const courseIds = enrollments.map((item) => item.courseId);
  const selectedCourseId = courseIds.includes(filters.courseId ?? "")
    ? filters.courseId
    : undefined;
  const search = filters.search?.trim().slice(0, 100);

  const accessFilter: Prisma.PeerQuestionWhereInput = selectedCourseId
    ? { courseId: selectedCourseId }
    : {
        OR: [
          { courseId: null },
          { courseId: { in: courseIds } },
        ],
      };
  const questionWhere: Prisma.PeerQuestionWhereInput = {
    semesterId: { in: cohortSemesterIds },
    AND: [
      accessFilter,
      ...(search
        ? [{
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { body: { contains: search, mode: "insensitive" as const } },
            ],
          }]
        : []),
    ],
  };

  const [peers, questions] = await Promise.all([
    courseIds.length
      ? prisma.user.findMany({
          where: {
            id: { not: userId },
            activeSemester: {
              academicYear: user.activeSemester!.academicYear,
              level: user.activeSemester!.level,
              term: user.activeSemester!.term,
            },
            enrollments: {
              some: {
                semesterId: { in: cohortSemesterIds },
                courseId: { in: courseIds },
              },
            },
          },
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            programme: true,
            activeSemester: { select: { level: true } },
            enrollments: {
              where: {
                semesterId: { in: cohortSemesterIds },
                courseId: { in: courseIds },
              },
              select: {
                course: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
          orderBy: { fullName: "asc" },
        })
      : [],
    prisma.peerQuestion.findMany({
      where: questionWhere,
      include: {
        author: {
          select: { id: true, fullName: true, avatarUrl: true, programme: true },
        },
        course: {
          select: { id: true, code: true, name: true },
        },
        answers: {
          include: {
            author: {
              select: { id: true, fullName: true, avatarUrl: true, programme: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        votes: {
          select: { userId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    activeSemester: user.activeSemester,
    profile,
    courses: enrollments.map((item) => item.course),
    groups: groups.map((group) => ({
      ...group,
      isOwner: group.ownerId === userId,
      isMember: group.members.some((member) => member.userId === userId),
      isFull: group.members.length >= group.maxMembers,
    })),
    peers: peers.map((peer) => ({
      id: peer.id,
      fullName: peer.fullName,
      avatarUrl: peer.avatarUrl,
      programme: peer.programme,
      level: peer.activeSemester?.level ?? null,
      sharedCourses: peer.enrollments.map((item) => item.course),
    })),
    questions: questions.map((question) => ({
      ...question,
      isOwner: question.userId === userId,
      isVoted: question.votes.some((vote) => vote.userId === userId),
      voteCount: question.votes.length,
      answers: question.answers.map((answer) => ({
        ...answer,
        isOwner: answer.userId === userId,
      })),
    })),
  };
}
