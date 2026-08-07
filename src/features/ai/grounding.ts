export type GroundingSource = {
  reference: string;
  materialTitle: string;
  sourceType: "PLATFORM" | "PRIVATE";
  topic: string | null;
  pageLabel: string | null;
};

type StoredMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
  contextUsed?: unknown;
};

const materialQuestionPattern = /\b(?:define|derive|describe|explain|calculate|compare|contrast|solve|what is|what are|why does|how does|concept|theorem|formula|principle|mechanism|example of)\b/i;
const recordQuestionPattern = /\b(?:my (?:grade|score|attendance|task|deadline|assessment|study plan|session)|when is my|what should i study|plan my|summari[sz]e my)\b/i;

export function requiresCourseMaterial(message: string) {
  return materialQuestionPattern.test(message) && !recordQuestionPattern.test(message);
}

export function insufficientMaterialResponse(course: { code: string; name: string }) {
  return `I do not have enough relevant ${course.code} - ${course.name} material to answer that reliably. Add course notes or choose a topic with published material, then ask again.`;
}

export function groundingSourcesFromContext(context: unknown): GroundingSource[] {
  if (!context || typeof context !== "object" || !("materialSources" in context)) return [];
  const sources = (context as { materialSources?: unknown }).materialSources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const value = source as Record<string, unknown>;
    if (typeof value.reference !== "string" || typeof value.materialTitle !== "string") return [];
    if (value.sourceType !== "PLATFORM" && value.sourceType !== "PRIVATE") return [];
    return [{
      reference: value.reference,
      materialTitle: value.materialTitle,
      sourceType: value.sourceType,
      topic: typeof value.topic === "string" ? value.topic : null,
      pageLabel: typeof value.pageLabel === "string" ? value.pageLabel : null,
    }];
  });
}

export function attachGroundingSources(messages: StoredMessage[]) {
  let pendingSources: GroundingSource[] = [];
  return messages.map((message) => {
    const ownSources = groundingSourcesFromContext(message.contextUsed);
    if (message.role === "USER") {
      pendingSources = ownSources;
      return { ...message, sources: [] as GroundingSource[] };
    }
    const sources = ownSources.length ? ownSources : pendingSources;
    pendingSources = [];
    return { ...message, sources };
  });
}

export function evaluateGroundedAnswer(input: {
  answer: string;
  availableReferences: string[];
  requiresGrounding: boolean;
}) {
  const cited = [...input.answer.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]);
  const issues: string[] = [];
  if (input.requiresGrounding && input.availableReferences.length > 0 && cited.length === 0) issues.push("missing_citation");
  if (cited.some((reference) => !input.availableReferences.includes(reference))) issues.push("unknown_citation");
  if (input.requiresGrounding && input.availableReferences.length === 0 && !/do not have enough relevant/i.test(input.answer)) issues.push("missing_insufficient_material_response");
  return { passed: issues.length === 0, citedReferences: [...new Set(cited)], issues };
}
