"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, LockKeyhole, Send, Square, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { MarkdownMessage } from "@/features/ai/markdown-message";
import { ChatMaterialUpload } from "@/features/materials/chat-material-upload";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

type AiChatClientProps = {
  conversationId: string | null;
  enrollmentId: string | null;
  courseLabel: string | null;
  initialMessages: ChatMessage[];
  isConfigured: boolean;
  remainingMessages: number;
  materialUpload: {
    semesterId: string;
    courseId: string;
    topics: Array<{ id: string; title: string }>;
  } | null;
};

export function AiChatClient({
  conversationId,
  enrollmentId,
  courseLabel,
  initialMessages,
  isConfigured,
  remainingMessages,
  materialUpload,
}: AiChatClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const [remaining, setRemaining] = useState(remainingMessages);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (
      !content
      || isSending
      || !isConfigured
      || remaining <= 0
      || (!currentConversationId && !enrollmentId)
    ) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const now = new Date().toISOString();
    setMessage("");
    setError("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: userId, role: "USER", content, createdAt: now },
      { id: assistantId, role: "ASSISTANT", content: "", createdAt: now },
    ]);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversationId ?? undefined,
          enrollmentId: currentConversationId ? undefined : enrollmentId ?? undefined,
          message: content,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "AI Chat request failed.");
      }
      if (!response.body) throw new Error("AI Chat returned an empty response.");

      const returnedConversationId = response.headers.get("x-conversation-id");
      if (returnedConversationId) setCurrentConversationId(returnedConversationId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, content: assistantContent } : item,
          ),
        );
      }

      setRemaining((value) => Math.max(value - 1, 0));
      if (returnedConversationId) {
        router.replace(`/ai-chat?conversation=${returnedConversationId}`);
      }
      router.refresh();
    } catch (caught) {
      if (controller.signal.aborted) {
        setMessages((current) => current.filter((item) => item.id !== assistantId));
        setError("Response stopped.");
      } else {
        setMessages((current) =>
          current.filter((item) => item.id !== userId && item.id !== assistantId),
        );
        setMessage(content);
        setError(caught instanceof Error ? caught.message : "AI Chat request failed.");
      }
    } finally {
      setAbortController(null);
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col lg:min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
      {messages.length ? (
          <div className="mx-auto grid max-w-3xl gap-5" aria-live="polite">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`flex gap-3 ${item.role === "USER" ? "justify-end" : "justify-start"}`}
              >
                {item.role === "ASSISTANT" ? (
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background">
                    <Bot className="h-4 w-4" />
                  </div>
                ) : null}
                <div
                  className={`max-w-[88%] overflow-hidden rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                    item.role === "USER"
                      ? "rounded-br-md bg-accent text-white"
                      : "rounded-bl-md border border-border bg-surface text-foreground"
                  }`}
                >
                  {item.content ? (
                    item.role === "ASSISTANT"
                      ? <MarkdownMessage content={item.content} />
                      : <p className="whitespace-pre-wrap break-words">{item.content}</p>
                  ) : (
                    <div className="flex gap-1 py-2" aria-label="BRAIL is responding">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
                {item.role === "USER" ? (
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background">
                    <User className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="grid min-h-[320px] place-items-center px-4 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface">
                <Bot className="h-6 w-6 text-accent" />
              </div>
              <h2 className="mt-4 text-lg font-semibold sm:text-xl">
                {courseLabel ? `Ask BRAIL about ${courseLabel}` : "Select a course conversation"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Only this course&apos;s performance, assessments, tasks, study sessions, and weak areas are used as context.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background/95 p-3 backdrop-blur sm:p-5">
        <div className="mx-auto max-w-3xl">
        {error ? <p className="mb-3 text-sm font-medium text-red-600">{error}</p> : null}
        {!isConfigured ? (
          <p className="mb-3 text-sm font-medium text-red-600">
            Add GROQ_API_KEY to .env.local and restart the server.
          </p>
        ) : null}
        <div className="mb-1 flex min-h-8 items-center justify-between gap-3 px-1">
          {enrollmentId && courseLabel && materialUpload ? (
            <ChatMaterialUpload
              enrollmentId={enrollmentId}
              semesterId={materialUpload.semesterId}
              courseId={materialUpload.courseId}
              courseLabel={courseLabel}
              topics={materialUpload.topics}
            />
          ) : <span />}
          {courseLabel ? (
            <span className="inline-flex items-center gap-1.5 truncate text-[11px] font-medium text-muted">
              <LockKeyhole className="h-3 w-3 shrink-0 text-accent" />
              <span className="truncate">{courseLabel} only</span>
            </span>
          ) : null}
        </div>
        <form action="#" onSubmit={sendMessage} className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm transition-shadow focus-within:border-foreground focus-within:shadow-md sm:gap-3">
          <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              maxLength={4000}
              rows={2}
              disabled={!isConfigured || remaining <= 0 || (!currentConversationId && !enrollmentId)}
              placeholder={remaining > 0
                ? courseLabel
                  ? `Ask about ${courseLabel}...`
                  : "Select a course conversation first"
                : "Daily message limit reached"}
              aria-label="Message BRAIL"
              className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          {isSending ? (
            <button
              type="button"
              onClick={() => abortController?.abort()}
              aria-label="Stop response"
              title="Stop response"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-background text-foreground"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                !message.trim()
                || !isConfigured
                || remaining <= 0
                || (!currentConversationId && !enrollmentId)
              }
              aria-label="Send message"
              title="Send message"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background transition-all hover:-translate-y-0.5 hover:opacity-85 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted sm:text-xs">
          <span className="truncate">BRAIL can make mistakes. Verify important academic information.</span>
          <span className="shrink-0">{remaining} left today</span>
        </div>
        </div>
      </div>
    </div>
  );
}
