"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAppUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";

export async function submitDiagnosticQuiz(formData: FormData) {
  const { appUser } = await requireAppUser();
  const quizId = String(formData.get("quizId") ?? "");

  const quiz = await prisma.diagnosticQuiz.findFirst({
    where: { id: quizId, userId: appUser.id },
    include: {
      enrollment: { include: { course: true } },
      questions: { orderBy: { position: "asc" } },
    },
  });
  if (!quiz) throw new Error("Diagnostic quiz not found.");
  if (quiz.status === "COMPLETED") redirect(`/practice/${quiz.id}`);

  const attempts = quiz.questions.map((question) => {
    const selectedAnswer = String(formData.get(`answer_${question.id}`) ?? "");
    if (!["A", "B", "C", "D"].includes(selectedAnswer)) {
      throw new Error("Answer every question before submitting.");
    }
    return {
      questionId: question.id,
      userId: appUser.id,
      selectedAnswer,
      isCorrect: selectedAnswer === question.correctAnswer,
    };
  });
  const score = attempts.filter((attempt) => attempt.isCorrect).length;
  const topicId = quiz.questions[0]?.topicId;
  const platformTopicId = quiz.questions[0]?.platformTopicId;
  if (!topicId && !platformTopicId) throw new Error("Diagnostic topic not found.");

  await prisma.$transaction([
    prisma.diagnosticAttempt.createMany({ data: attempts, skipDuplicates: true }),
    prisma.diagnosticQuiz.update({
      where: { id: quiz.id },
      data: {
        status: "COMPLETED",
        score,
        maxScore: quiz.questions.length,
        startedAt: quiz.startedAt ?? quiz.createdAt,
        completedAt: new Date(),
      },
    }),
  ]);

  const [attemptCount, correctCount, topic] = await Promise.all([
    prisma.diagnosticAttempt.count({
      where: {
        userId: appUser.id,
        question: platformTopicId
          ? { platformTopicId, quiz: { enrollmentId: quiz.enrollmentId } }
          : { topicId, quiz: { enrollmentId: quiz.enrollmentId } },
      },
    }),
    prisma.diagnosticAttempt.count({
      where: {
        userId: appUser.id,
        isCorrect: true,
        question: platformTopicId
          ? { platformTopicId, quiz: { enrollmentId: quiz.enrollmentId } }
          : { topicId, quiz: { enrollmentId: quiz.enrollmentId } },
      },
    }),
    platformTopicId
      ? prisma.platformCourseTopic.findUnique({ where: { id: platformTopicId }, select: { title: true } })
      : prisma.courseTopic.findUnique({ where: { id: topicId! }, select: { title: true } }),
  ]);
  const masteryScore = attemptCount ? Math.round((correctCount / attemptCount) * 10000) / 100 : 0;

  if (platformTopicId) {
    await prisma.topicMastery.upsert({
      where: {
        userId_enrollmentId_platformTopicId: {
          userId: appUser.id,
          enrollmentId: quiz.enrollmentId,
          platformTopicId,
        },
      },
      update: { attemptCount, correctCount, masteryScore },
      create: { userId: appUser.id, enrollmentId: quiz.enrollmentId, platformTopicId, attemptCount, correctCount, masteryScore },
    });
  } else {
    await prisma.topicMastery.upsert({
      where: {
        userId_enrollmentId_topicId: {
          userId: appUser.id,
          enrollmentId: quiz.enrollmentId,
          topicId: topicId!,
        },
      },
      update: { attemptCount, correctCount, masteryScore },
      create: { userId: appUser.id, enrollmentId: quiz.enrollmentId, topicId: topicId!, attemptCount, correctCount, masteryScore },
    });
  }

  if (topic && attemptCount >= 3) {
    const existingWeakArea = await prisma.weakArea.findFirst({
      where: {
        userId: appUser.id,
        semesterId: quiz.enrollment.semesterId,
        courseId: quiz.enrollment.courseId,
        topic: topic.title,
        detectedFrom: "diagnostic practice",
      },
      select: { id: true },
    });

    if (masteryScore < 70) {
      const data = {
        weaknessScore: 100 - masteryScore,
        recommendation: `Review ${topic.title}, then take another diagnostic quiz.`,
      };
      if (existingWeakArea) {
        await prisma.weakArea.update({ where: { id: existingWeakArea.id }, data });
      } else {
        await prisma.weakArea.create({
          data: {
            userId: appUser.id,
            semesterId: quiz.enrollment.semesterId,
            courseId: quiz.enrollment.courseId,
            topic: topic.title,
            detectedFrom: "diagnostic practice",
            ...data,
          },
        });
      }
    } else if (existingWeakArea) {
      await prisma.weakArea.delete({ where: { id: existingWeakArea.id } });
    }
  }

  revalidatePath("/practice");
  revalidatePath(`/practice/${quiz.id}`);
  revalidatePath("/performance");
  redirect(`/practice/${quiz.id}`);
}
