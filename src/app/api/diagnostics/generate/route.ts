import { NextResponse } from "next/server";

import { aiModel, createChatCompletion, isAiConfigured } from "@/features/ai/provider";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import {
  generateDiagnosticSchema,
  generatedQuestionSetSchema,
} from "@/features/diagnostics/schemas";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseJsonObject(raw: string) {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("The AI did not return a valid question set.");
  return JSON.parse(json) as unknown;
}

export async function POST(request: Request) {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser?.activeSemesterId) {
    return NextResponse.json({ message: "Set an active semester first." }, { status: 400 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ message: "AI generation is not configured." }, { status: 503 });
  }

  const parsed = generateDiagnosticSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a topic and 4-10 questions." }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: parsed.data.enrollmentId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    include: { course: true },
  });
  if (!enrollment) {
    return NextResponse.json({ message: "Course enrollment not found." }, { status: 404 });
  }

  const platformTopic = await prisma.platformCourseTopic.findFirst({
    where: { id: parsed.data.topicId, courseId: enrollment.courseId, isArchived: false },
  });
  const platformChunks = platformTopic ? await prisma.platformMaterialChunk.findMany({
    where: {
      material: {
        status: "PUBLISHED",
        topicLinks: { some: { topicId: platformTopic.id } },
      },
    },
    include: { material: { select: { title: true } } },
    orderBy: [{ materialId: "asc" }, { chunkIndex: "asc" }],
    take: 16,
  }) : [];
  const privateTopic = platformTopic ? null : await prisma.courseTopic.findFirst({
    where: { id: parsed.data.topicId, enrollmentId: enrollment.id },
    include: {
      chunks: {
        where: { material: { status: "READY" } },
        include: { material: { select: { title: true } } },
        orderBy: [{ materialId: "asc" }, { chunkIndex: "asc" }],
        take: 16,
      },
    },
  });
  const topic = platformTopic ?? privateTopic;
  if (!topic) {
    return NextResponse.json({ message: "Course topic not found." }, { status: 404 });
  }
  const topicChunks = platformTopic ? platformChunks : privateTopic?.chunks ?? [];
  if (!topicChunks.length) {
    return NextResponse.json(
      { message: "Add course material to this topic before generating questions." },
      { status: 400 },
    );
  }

  const sources = topicChunks.map((chunk, index) => ({
    reference: `S${index + 1}`,
    material: chunk.material.title,
    content: chunk.content,
  }));

  let generated;
  try {
    const raw = await createChatCompletion(
      [
        {
          role: "system",
          content: [
            "Generate a university diagnostic quiz using only the supplied course passages.",
            "Every question must have exactly four distinct options. Only one option may be correct.",
            "Avoid trick questions, ambiguous wording, and questions whose answer is not supported by a cited passage.",
            "Use this difficulty mix as closely as possible: 30% EASY, 50% MEDIUM, 20% HARD.",
            "Do not include markdown or commentary.",
            'Return only JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"correctAnswer":"A","explanation":"...","difficulty":"EASY","sourceRefs":["S1"]}]}',
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            course: `${enrollment.course.code} - ${enrollment.course.name}`,
            topic: topic.title,
            learningOutcomes: platformTopic?.learningOutcomes ?? undefined,
            questionCount: parsed.data.questionCount,
            sources,
          }),
        },
      ],
      { temperature: 0.25, maxCompletionTokens: 3500, signal: request.signal },
    );
    generated = generatedQuestionSetSchema.parse(parseJsonObject(raw));
  } catch (error) {
    console.error("Diagnostic generation failed", error);
    return NextResponse.json(
      { message: "Could not generate a valid question set. Try again." },
      { status: 502 },
    );
  }

  if (generated.questions.length !== parsed.data.questionCount) {
    return NextResponse.json(
      { message: "The generated question count was invalid. Try again." },
      { status: 502 },
    );
  }

  const quiz = await prisma.diagnosticQuiz.create({
    data: {
      userId: appUser.id,
      enrollmentId: enrollment.id,
      title: `${topic.title} diagnostic`,
      model: aiModel,
      blueprint: {
        topicId: topic.id,
        topicSource: platformTopic ? "PLATFORM" : "PRIVATE",
        topicTitle: topic.title,
        requestedQuestionCount: parsed.data.questionCount,
        sourceCount: sources.length,
      },
      maxScore: generated.questions.length,
      questions: {
        create: generated.questions.map((question, position) => ({
          topicId: privateTopic?.id,
          platformTopicId: platformTopic?.id,
          position,
          prompt: question.prompt,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          difficulty: question.difficulty,
          sourceRefs: question.sourceRefs,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ quizId: quiz.id });
}
