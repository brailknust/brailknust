import { NextResponse } from "next/server";

import { buildAcademicContext } from "@/features/ai/context";
import {
  classifyCourseMessage,
  courseScopeRefusal,
  type CourseScopeDecision,
} from "@/features/ai/course-scope";
import {
  aiModel,
  createChatCompletionStream,
  dailyMessageLimit,
  isAiConfigured,
  type AiProviderMessage,
} from "@/features/ai/provider";
import { sendAiMessageSchema } from "@/features/ai/schemas";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { retrieveCourseMaterialContext } from "@/features/materials/retrieval";
import { prisma } from "@/server/db";

function conversationTitle(message: string) {
  const firstLine = message.replace(/\s+/g, " ").trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

export async function POST(request: Request) {
  const authUser = await getSupabaseUser();
  if (!authUser) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const appUser = await getAppUserByAuthId(authUser.id);
  if (!appUser) return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  if (!appUser.activeSemesterId) {
    return NextResponse.json({ error: "Set an active semester before using AI Chat." }, { status: 400 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI Chat is not configured. Add GROQ_API_KEY to .env.local." }, { status: 503 });
  }

  let parsed;
  try {
    parsed = sendAiMessageSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid message of up to 4,000 characters." }, { status: 400 });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const usedToday = await prisma.aiMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: dayStart },
      conversation: { userId: appUser.id },
    },
  });
  if (usedToday >= dailyMessageLimit) {
    return NextResponse.json(
      { error: `Daily AI Chat limit reached (${dailyMessageLimit} messages).` },
      { status: 429 },
    );
  }

  let createdConversation = false;
  let conversation = parsed.conversationId
    ? await prisma.aiConversation.findFirst({
        where: {
          id: parsed.conversationId,
          userId: appUser.id,
          semesterId: appUser.activeSemesterId,
          enrollment: {
            userId: appUser.id,
            semesterId: appUser.activeSemesterId,
          },
        },
      })
    : null;

  if (parsed.conversationId && !conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (!conversation) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: parsed.enrollmentId,
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "Select a course from your active semester." },
        { status: 400 },
      );
    }

    conversation = await prisma.aiConversation.create({
      data: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        enrollmentId: enrollment.id,
        title: conversationTitle(parsed.message),
      },
    });
    createdConversation = true;
  }

  const { systemPrompt, snapshot, scope } = await buildAcademicContext(
    appUser.id,
    appUser.activeSemesterId,
    conversation.enrollmentId,
  );

  let scopeDecision: CourseScopeDecision | null = null;
  try {
    scopeDecision = await classifyCourseMessage(parsed.message, scope, request.signal);
  } catch (error) {
    // The main course prompt remains a second scope safeguard. A classifier
    // formatting failure should not make an otherwise available chat unusable.
    console.error("AI course-scope classification failed", error);
  }

  if (scopeDecision?.blocked) {
    const refusal = courseScopeRefusal(scope);
    await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content: parsed.message,
          contextUsed: {
            ...snapshot,
            scopeDecision: {
              decision: scopeDecision.decision,
              confidence: scopeDecision.confidence,
              reason: scopeDecision.reason ?? null,
            },
          },
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: refusal,
          model: aiModel,
        },
      }),
      prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return new Response(refusal, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": conversation.id,
        "X-Course-Scope": "blocked",
      },
    });
  }

  const materialContext = await retrieveCourseMaterialContext(
    conversation.enrollmentId,
    parsed.message,
  );
  const messageContext = {
    ...snapshot,
    scopeDecision: scopeDecision
      ? {
          decision: scopeDecision.decision,
          confidence: scopeDecision.confidence,
          reason: scopeDecision.reason ?? null,
        }
      : null,
    materialSources: materialContext.sources,
  };

  const userMessage = await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: parsed.message,
      contextUsed: messageContext,
    },
  });

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 16,
    select: { role: true, content: true },
  });

  const providerMessages: AiProviderMessage[] = [
    { role: "system", content: systemPrompt },
    ...(materialContext.passages.length
      ? [{
          role: "system" as const,
          content: [
            "RETRIEVED COURSE MATERIAL:",
            "Use these passages when they support the answer. PLATFORM passages are centrally published course content; PRIVATE passages are the student's own uploads. Prefer PLATFORM passages when sources conflict. Cite supporting passages inline as [S1], [S2], and so on. Do not cite a passage that does not support the claim. If the passages are insufficient, say so rather than inventing course-specific facts.",
            JSON.stringify(materialContext.passages),
          ].join("\n"),
        }]
      : []),
    ...history.reverse().map((message) => ({
      role: message.role === "USER" ? "user" as const : "assistant" as const,
      content: message.content.slice(0, 6000),
    })),
  ];

  let deltas;
  try {
    deltas = await createChatCompletionStream(providerMessages, request.signal);
  } catch (error) {
    console.error("AI provider request failed", error);
    await prisma.aiMessage.delete({ where: { id: userMessage.id } });
    if (createdConversation) {
      await prisma.aiConversation.delete({ where: { id: conversation.id } });
    }
    return NextResponse.json(
      { error: "The AI provider is unavailable. Check the API key, model, or free-tier limit." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const conversationId = conversation.id;
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      try {
        for await (const delta of deltas) {
          assistantText += delta;
          controller.enqueue(encoder.encode(delta));
        }

        if (assistantText.trim()) {
          await prisma.$transaction([
            prisma.aiMessage.create({
              data: {
                conversationId,
                role: "ASSISTANT",
                content: assistantText,
                model: aiModel,
              },
            }),
            prisma.aiConversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            }),
          ]);
        }
        controller.close();
      } catch (error) {
        console.error("AI response stream failed", error);
        controller.error(error);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversation.id,
    },
  });
}
