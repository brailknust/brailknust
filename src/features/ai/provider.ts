import "server-only";

import { serverEnv } from "@/lib/env";

export type AiProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiResponseFormat = "json_object" | {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

export const aiModel = serverEnv.AI_MODEL ?? "openai/gpt-oss-20b";
export const dailyMessageLimit = serverEnv.AI_DAILY_MESSAGE_LIMIT ?? 20;
const providerTimeoutMs = 45_000;
const providerRetryCount = 2;

export function isAiConfigured() {
  return Boolean(serverEnv.GROQ_API_KEY);
}

async function fetchProvider(request: RequestInfo | URL, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= providerRetryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);
    const callerSignal = init.signal;
    const abortCaller = () => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener("abort", abortCaller, { once: true });

    try {
      const response = await fetch(request, { ...init, signal: controller.signal });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === providerRetryCount) {
        return response;
      }

      await response.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    } catch (error) {
      lastError = error;
      if (callerSignal?.aborted || attempt === providerRetryCount) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortCaller);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI provider request failed.");
}

export async function createChatCompletionStream(
  messages: AiProviderMessage[],
  signal?: AbortSignal,
) {
  if (!serverEnv.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await fetchProvider("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.35,
      max_completion_tokens: 1200,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Groq request failed (${response.status}): ${detail}`);
  }
  if (!response.body) throw new Error("Groq returned an empty response stream.");

  const body = response.body;

  async function* textDeltas() {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const data = line.trim().replace(/^data:\s*/, "");
          if (!data || data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string | null } }>;
            };
            const content = event.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore non-JSON keepalive events from the upstream stream.
          }
        }

        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }

  return textDeltas();
}

export async function createChatCompletion(
  messages: AiProviderMessage[],
  options?: {
    maxCompletionTokens?: number;
    temperature?: number;
    responseFormat?: AiResponseFormat;
    reasoningEffort?: "low" | "medium" | "high";
    signal?: AbortSignal;
  },
) {
  if (!serverEnv.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await fetchProvider("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: options?.temperature ?? 0,
      max_completion_tokens: options?.maxCompletionTokens ?? 180,
      response_format: typeof options?.responseFormat === "string"
        ? { type: options.responseFormat }
        : options?.responseFormat,
      reasoning_effort: options?.reasoningEffort,
      stream: false,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Groq request failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned an empty completion.");

  return content;
}
