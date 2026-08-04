import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import { type E2eFixture, fixturePath, type TestIdentity } from "./fixture";
import { loadE2eEnvironment } from "./environment";

loadE2eEnvironment();

const prisma = new PrismaClient();
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function createAuthIdentity(role: string, runId: string, password: string) {
  const email = `brail-e2e-${role}-${runId}@example.com`;
  const result = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `BRAIL E2E ${role}` },
  });
  if (result.error || !result.data.user) {
    throw new Error(`Could not create the temporary ${role} Auth user.`);
  }
  return { authUserId: result.data.user.id, email } satisfies TestIdentity;
}

async function createStudent(
  identity: TestIdentity,
  runId: string,
  role: "STUDENT" | "ADMIN" = "STUDENT",
) {
  const user = await prisma.user.create({
    data: {
      authUserId: identity.authUserId,
      email: identity.email,
      fullName: `BRAIL E2E ${role.toLowerCase()} ${runId}`,
      studentId: `E2E-${role}-${identity.authUserId}`,
      college: "College of Engineering",
      programme: "Computer Engineering",
      department: "Department of Computer Engineering",
      level: "LEVEL_200",
      cwa: 72,
      role,
    },
  });
  return { ...identity, appUserId: user.id };
}

async function createSemester(userId: string, runId: string) {
  const semester = await prisma.semester.create({
    data: {
      ownerId: userId,
      level: "LEVEL_200",
      term: "FIRST",
      name: `Phase 2 Semester ${runId}`,
      academicYear: "2098/2099",
      cwa: 72,
      isActive: true,
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { activeSemesterId: semester.id } });
  await prisma.semesterProfile.create({
    data: { userId, semesterId: semester.id, level: "LEVEL_200", cwa: 72 },
  });
  return semester;
}

export default async function globalSetup() {
  const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const password = `Phase2-${randomUUID()}-Aa1!`;
  const identities: TestIdentity[] = [];
  let courseId: string | undefined;

  try {
    const primaryAuth = await createAuthIdentity("primary", runId, password);
    const onboarding = await createAuthIdentity("onboarding", runId, password);
    const peerAuth = await createAuthIdentity("peer", runId, password);
    const adminAuth = await createAuthIdentity("admin", runId, password);
    identities.push(primaryAuth, onboarding, peerAuth, adminAuth);

    const primary = await createStudent(primaryAuth, runId);
    const peer = await createStudent(peerAuth, runId);
    const admin = await createStudent(adminAuth, runId, "ADMIN");
    identities.splice(0, identities.length, primary, onboarding, peer, admin);

    const course = await prisma.course.create({
      data: {
        code: `E2E ${runId.slice(-6).toUpperCase()}`,
        name: `Phase 2 Test Course ${runId}`,
        creditHours: 3,
        department: "Computer Engineering",
        level: "LEVEL_200",
        approvalStatus: "OFFICIAL",
      },
    });
    courseId = course.id;

    const primarySemester = await createSemester(primary.appUserId!, runId);
    const peerSemester = await createSemester(peer.appUserId!, runId);
    const primaryEnrollment = await prisma.enrollment.create({
      data: { userId: primary.appUserId!, semesterId: primarySemester.id, courseId: course.id },
    });
    await prisma.enrollment.create({
      data: { userId: peer.appUserId!, semesterId: peerSemester.id, courseId: course.id },
    });

    const topic = await prisma.courseTopic.create({
      data: { enrollmentId: primaryEnrollment.id, title: "Queue fundamentals", sequence: 0 },
    });
    const material = await prisma.courseMaterial.create({
      data: {
        enrollmentId: primaryEnrollment.id,
        uploadedBy: primary.appUserId!,
        title: "Seeded queue notes",
        type: "NOTE",
        status: "READY",
      },
    });
    await prisma.materialChunk.create({
      data: {
        materialId: material.id,
        topicId: topic.id,
        chunkIndex: 0,
        content: "A queue follows first-in first-out ordering. Enqueue adds an item and dequeue removes the oldest item.",
        charCount: 101,
      },
    });

    await prisma.aiConversation.create({
      data: {
        userId: primary.appUserId!,
        semesterId: primarySemester.id,
        enrollmentId: primaryEnrollment.id,
        title: "Phase 2 course chat",
        isPinned: true,
      },
    });

    const diagnostic = await prisma.diagnosticQuiz.create({
      data: {
        userId: primary.appUserId!,
        enrollmentId: primaryEnrollment.id,
        title: `Queue diagnostic ${runId}`,
        blueprint: { source: "e2e" },
        questions: {
          create: Array.from({ length: 4 }, (_, index) => ({
            topicId: topic.id,
            position: index,
            prompt: `Queue test question ${index + 1}: which answer is correct?`,
            options: ["Correct queue answer", "Stack answer", "Tree answer", "Graph answer"],
            correctAnswer: "A",
            explanation: "The first option follows the seeded queue material.",
            difficulty: "EASY",
            sourceRefs: ["S1"],
          })),
        },
      },
    });

    const peerQuestionTitle = `Phase 2 peer question ${runId}`;
    await prisma.peerQuestion.create({
      data: {
        userId: peer.appUserId!,
        semesterId: peerSemester.id,
        courseId: course.id,
        title: peerQuestionTitle,
        body: "How should we explain queue operations clearly for the upcoming assessment?",
      },
    });
    const group = await prisma.studyGroup.create({
      data: {
        ownerId: peer.appUserId!,
        semesterId: peerSemester.id,
        courseId: course.id,
        name: `Phase 2 study group ${runId}`,
        maxMembers: 8,
      },
    });
    await prisma.studyGroupMember.create({
      data: { groupId: group.id, userId: peer.appUserId!, role: "owner" },
    });

    const notificationTitle = `Phase 2 reminder ${runId}`;
    await prisma.notification.create({
      data: {
        userId: primary.appUserId!,
        semesterId: primarySemester.id,
        title: notificationTitle,
        message: "This synthetic reminder verifies the notification journey.",
        type: "SYSTEM",
        sourceKey: `e2e:${runId}`,
      },
    });

    const bucket = await service.storage.getBucket("course-materials");
    if (!bucket.data) {
      const created = await service.storage.createBucket("course-materials", { public: false });
      if (created.error) throw new Error("Could not create the private E2E material bucket.");
    } else if (bucket.data.public) {
      throw new Error("The E2E material bucket must be private.");
    }

    const fixture: E2eFixture = {
      runId,
      password,
      users: { primary, onboarding, peer, admin },
      primarySemesterId: primarySemester.id,
      primaryEnrollmentId: primaryEnrollment.id,
      courseId: course.id,
      courseName: course.name,
      diagnosticQuizId: diagnostic.id,
      peerQuestionTitle,
      notificationTitle,
    };
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2), "utf8");
  } catch (error) {
    await prisma.user.deleteMany({
      where: { authUserId: { in: identities.map((identity) => identity.authUserId) } },
    }).catch(() => undefined);
    if (courseId) {
      await prisma.course.deleteMany({ where: { id: courseId } }).catch(() => undefined);
    }
    await Promise.all(identities.map((identity) => service.auth.admin.deleteUser(identity.authUserId)));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
