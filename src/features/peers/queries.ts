import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

type PeerFilters = {
  search?: string;
  courseId?: string;
};

function normalizeTopicKey(value: string) {
  return value.trim().toLowerCase();
}

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

  // For peer matching, get all semesters in same academic year and level (allows different terms)
  const peerMatchSemesters = await prisma.semester.findMany({
    where: {
      academicYear: user.activeSemester!.academicYear,
      level: user.activeSemester!.level,
      // No term filter - allows matching across different semesters in same year/level
    },
    select: { id: true },
  });
  const peerMatchSemesterIds = peerMatchSemesters.map((semester) => semester.id);
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

  // Get user's weak areas for matching (from their cohort semesters)
  const userWeakAreas = await prisma.weakArea.findMany({
    where: {
      userId,
      semesterId: { in: cohortSemesterIds },
    },
    select: {
      topic: true,
      courseId: true,
    },
  });
  const weakTopicKeys = new Set(userWeakAreas.map((weakArea) => normalizeTopicKey(weakArea.topic)));
  const weakCourseIds = [...new Set(userWeakAreas.map((weakArea) => weakArea.courseId))];

  // If user has weak areas, find peers who are strong in those areas
  const peerMatches = userWeakAreas.length
    ? await prisma.user.findMany({
        where: {
          id: { not: userId },
          activeSemester: {
            // Match within same academic year only, allow different semesters/levels
            academicYear: user.activeSemester!.academicYear,
          },
          // Peer must have enrollments in same academic year/level
          enrollments: {
            some: {
              semesterId: { in: peerMatchSemesterIds },
            },
          },
          // Peer must have strong mastery in at least one of user's weak topics
          topicMasteries: {
            some: {
              masteryScore: { gte: 70 }, // Strong mastery threshold
              enrollment: {
                semesterId: { in: peerMatchSemesterIds },
              },
              OR: [
                {
                  topic: {
                    title: { in: userWeakAreas.map((w) => w.topic) },
                  },
                },
                {
                  enrollment: {
                    courseId: { in: weakCourseIds },
                  },
                },
              ],
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          programme: true,
          activeSemester: { select: { level: true } },
          topicMasteries: {
            where: {
              OR: [
                {
                  topic: {
                    title: { in: userWeakAreas.map((w) => w.topic) },
                  },
                },
                {
                  enrollment: {
                    courseId: { in: weakCourseIds },
                  },
                },
              ],
              enrollment: {
                semesterId: { in: peerMatchSemesterIds },
              },
            },
            select: {
              masteryScore: true,
              topic: { select: { title: true } },
            },
          },
        },
      })
    : [];

  // Sort peers by average strength in user's weak areas
  const sortedPeers = peerMatches
    .map((peer) => {
      const avgStrength =
        peer.topicMasteries.length > 0
          ? peer.topicMasteries.reduce((sum, tm) => sum + tm.masteryScore.toNumber(), 0) /
            peer.topicMasteries.length
          : 0;
      return { ...peer, strengthScore: avgStrength };
    })
    .sort((a, b) => b.strengthScore - a.strengthScore);

  const peers = sortedPeers.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
    programme: p.programme,
    level: p.activeSemester?.level ?? null,
    sharedCourses: [], // Weak area matched peers may not share courses
    strengthScore: p.strengthScore,
    matchedTopics: [...new Set(
      p.topicMasteries
        .map((tm) => tm.topic?.title)
        .filter((title): title is string => Boolean(title))
        .filter((title) => weakTopicKeys.has(normalizeTopicKey(title))),
    )],
  }));

  const questions = await prisma.peerQuestion.findMany({
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
  });

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
      level: peer.level ?? null,
      sharedCourses: peer.sharedCourses,
      // Weakness-based matching data
      strengthScore: peer.strengthScore,
      matchedTopics: peer.matchedTopics,
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
