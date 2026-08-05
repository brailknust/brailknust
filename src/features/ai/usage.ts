import "server-only";

import { serverEnv } from "@/lib/env";
import { prisma } from "@/server/db";

export const aiDailyTokenLimit = serverEnv.AI_DAILY_TOKEN_LIMIT ?? 50_000;
export const aiGlobalDailyTokenLimit = serverEnv.AI_GLOBAL_DAILY_TOKEN_LIMIT ?? 1_000_000;

type AiUsageOperation = "CHAT" | "DIAGNOSTIC";

export function estimateTokenCount(value: string) {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}

export function estimateMessageTokens(messages: Array<{ content: string }>) {
  return messages.reduce((total, message) => total + estimateTokenCount(message.content), 0);
}

function startOfAccraDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function estimateCostMicros(promptTokens: number, completionTokens: number) {
  const inputCost = serverEnv.AI_INPUT_COST_PER_MILLION_USD ?? 0;
  const outputCost = serverEnv.AI_OUTPUT_COST_PER_MILLION_USD ?? 0;
  return Math.round(promptTokens * inputCost + completionTokens * outputCost);
}

export async function checkAiUsageQuota(userId: string, reservedTokens: number) {
  const createdAt = { gte: startOfAccraDay() };
  const [userUsage, globalUsage] = await Promise.all([
    prisma.aiUsageEvent.aggregate({ where: { userId, createdAt }, _sum: { totalTokens: true } }),
    prisma.aiUsageEvent.aggregate({ where: { createdAt }, _sum: { totalTokens: true } }),
  ]);
  const userTokens = userUsage._sum.totalTokens ?? 0;
  const globalTokens = globalUsage._sum.totalTokens ?? 0;

  if (userTokens + reservedTokens > aiDailyTokenLimit) {
    return { allowed: false as const, message: "Your daily AI token limit has been reached. Try again tomorrow." };
  }
  if (globalTokens + reservedTokens > aiGlobalDailyTokenLimit) {
    return { allowed: false as const, message: "BRAIL's AI capacity is reached for today. Try again later." };
  }
  return { allowed: true as const };
}

export async function recordAiUsage(input: {
  userId: string;
  semesterId?: string | null;
  operation: AiUsageOperation;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs?: number;
  succeeded: boolean;
  failureCode?: string;
}) {
  const totalTokens = input.promptTokens + input.completionTokens;
  await prisma.aiUsageEvent.create({
    data: {
      userId: input.userId,
      semesterId: input.semesterId ?? null,
      operation: input.operation,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens,
      latencyMs: input.latencyMs,
      estimatedCostMicros: estimateCostMicros(input.promptTokens, input.completionTokens),
      succeeded: input.succeeded,
      failureCode: input.failureCode,
    },
  });
}
