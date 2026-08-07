import type { Prisma } from "@prisma/client";

const blockedMetadataKey = /(auth|content|email|message|password|secret|student|token)/i;

export function safeAuditMetadata(input: Record<string, unknown>): Prisma.InputJsonObject {
  const output: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (blockedMetadataKey.test(key) || value === undefined) continue;
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      output[key] = value;
    } else if (typeof value === "string") {
      output[key] = value.slice(0, 300);
    } else if (Array.isArray(value)) {
      output[key] = value
        .filter((item): item is string | number | boolean => ["string", "number", "boolean"].includes(typeof item))
        .slice(0, 50)
        .map((item) => typeof item === "string" ? item.slice(0, 100) : item);
    }
  }
  return output as Prisma.InputJsonObject;
}

export async function createAdminContentAudit(
  tx: Prisma.TransactionClient,
  event: {
    actorId: string;
    action: string;
    targetType: "CATALOG" | "TOPIC" | "MATERIAL";
    targetId: string;
    targetLabel?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return tx.adminContentAudit.create({
    data: {
      actorId: event.actorId,
      action: event.action.slice(0, 80),
      targetType: event.targetType,
      targetId: event.targetId.slice(0, 300),
      targetLabel: event.targetLabel?.slice(0, 300) ?? null,
      metadata: safeAuditMetadata(event.metadata ?? {}),
    },
  });
}
