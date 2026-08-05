import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  MessageSquarePlus,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  createAiConversation,
  deleteAiConversation,
  renameAiConversation,
} from "@/features/ai/actions";
import { AiChatClient } from "@/features/ai/chat-client";
import { getAiChatPageData } from "@/features/ai/queries";
import { requireAppUser } from "@/features/auth/queries";

type AiChatPageProps = {
  searchParams: Promise<{ conversation?: string }>;
};

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric" }).format(value);
}

export default async function AiChatPage({ searchParams }: AiChatPageProps) {
  const { appUser } = await requireAppUser();
  const params = await searchParams;
  const data = await getAiChatPageData(
    appUser.id,
    appUser.activeSemesterId,
    params.conversation,
  );

  if (!data.activeSemester) {
    return (
      <AppShell title="AI Chat" eyebrow="AI Support">
        <section className="rounded-2xl border border-border bg-white p-6">
          <Bot className="h-6 w-6 text-accent" />
          <h2 className="mt-5 text-xl font-semibold">Set an active semester first</h2>
          <p className="mt-2 text-sm text-muted">BRAIL uses active-semester records to provide relevant academic support.</p>
          <Link href="/academics" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
            Choose a semester <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </AppShell>
    );
  }

  const level = data.profile?.level
    ? `Level ${data.profile.level.replace("LEVEL_", "")}`
    : "Level not set";
  const selectedId = data.selectedConversation?.id ?? null;

  return (
    <AppShell title="AI Chat" eyebrow="AI Support">
      <section className="mb-4 flex items-center justify-between gap-4 rounded-2xl bg-[var(--accent-strong)] p-4 text-white sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
            Academic context
          </p>
          <h2 className="mt-1.5 text-base font-semibold sm:text-lg">
            {level} · {data.activeSemester.name}
          </h2>
          <p className="mt-0.5 text-xs text-white/60">{data.activeSemester.academicYear}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center sm:px-4">
          <p className="text-lg font-semibold">{Math.max(data.dailyLimit - data.usedToday, 0)}</p>
          <p className="text-[11px] leading-4 text-white/60">
            <span className="sm:hidden">messages left</span>
            <span className="hidden sm:inline">messages left today</span>
          </p>
        </div>
      </section>

      <div className="grid overflow-hidden rounded-2xl border border-border bg-white lg:h-[calc(100dvh-12rem)] lg:min-h-[680px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Conversations</p>
                <p className="mt-0.5 text-xs text-muted">Course-specific AI support</p>
              </div>
              <span className="rounded-full border border-border bg-white px-2 py-1 text-xs text-muted">
                {data.conversations.length}
              </span>
            </div>
          {data.enrollments.length ? (
            <form action={createAiConversation} className="grid gap-2">
              <label htmlFor="new-chat-course" className="text-xs font-medium text-muted">
                Start another conversation
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <select
                    id="new-chat-course"
                    name="enrollmentId"
                    required
                    defaultValue=""
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-white px-3 pr-9 text-sm outline-none focus:border-foreground"
                  >
                    <option value="" disabled>Select a course</option>
                    {data.enrollments.map((enrollment) => (
                      <option key={enrollment.id} value={enrollment.id}>
                        {enrollment.course.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
                <PendingSubmitButton
                  pendingLabel=""
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white transition-opacity hover:opacity-85"
                  aria-label="Create conversation"
                  title="Create conversation"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </PendingSubmitButton>
              </div>
            </form>
          ) : (
            <p className="rounded-xl border border-border bg-white p-3 text-sm text-muted">
              Enroll in an active-semester course to start chatting.
            </p>
          )}
          </div>

          <div className="grid max-h-[300px] gap-2 overflow-y-auto p-3 lg:max-h-none lg:flex-1">
            {data.conversations.length ? data.conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative rounded-xl border transition-colors ${
                  selectedId === conversation.id
                    ? "border-foreground bg-white shadow-sm"
                    : "border-transparent hover:border-border hover:bg-white/65"
                }`}
              >
                <Link
                  href={`/ai-chat?conversation=${conversation.id}`}
                  aria-current={selectedId === conversation.id ? "page" : undefined}
                  className="block min-w-0 p-3 pr-20"
                >
                  {conversation.isPinned ? (
                    <>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                        <Pin className="h-3 w-3" /> Pinned course chat
                      </p>
                      <p className="mt-1.5 truncate text-sm font-semibold">
                        {conversation.enrollment.course.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold">{conversation.title}</p>
                      <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted">
                        {conversation.enrollment.course.name}
                      </p>
                    </>
                  )}
                  <p className="mt-1.5 text-xs text-muted">
                    {conversation._count.messages} {conversation._count.messages === 1 ? "message" : "messages"} · {dateLabel(conversation.updatedAt)}
                  </p>
                </Link>
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <details>
                    <summary
                      className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-xl text-muted hover:bg-surface hover:text-foreground"
                      title="Rename conversation"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </summary>
                    <form action={renameAiConversation} className="absolute right-0 top-9 z-10 grid w-64 gap-2 rounded-xl border border-border bg-white p-3 shadow-lg">
                      <input type="hidden" name="conversationId" value={conversation.id} />
                      <label className="text-xs font-semibold" htmlFor={`conversation-title-${conversation.id}`}>
                        Conversation name
                      </label>
                      <input id={`conversation-title-${conversation.id}`} name="title" required maxLength={100} defaultValue={conversation.title} className="h-9 min-w-0 rounded-xl border border-border bg-surface px-2 text-xs outline-none focus:border-foreground" />
                      <PendingSubmitButton pendingLabel="Saving..." className="h-8 rounded-xl bg-[var(--accent-strong)] px-3 text-xs font-semibold text-white">Save</PendingSubmitButton>
                    </form>
                  </details>
                  {!conversation.isPinned ? (
                    <form action={deleteAiConversation}>
                      <input type="hidden" name="conversationId" value={conversation.id} />
                      <ConfirmSubmitButton
                        message={`Delete "${conversation.title}" and its messages?`}
                        className="grid h-8 w-8 place-items-center rounded-xl text-muted hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete conversation"
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            )) : (
              <p className="px-2 py-4 text-sm text-muted">No saved conversations.</p>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex items-center gap-3 border-b border-border bg-white/95 px-4 py-3 sm:px-5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-strong)] text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{data.selectedConversation?.title ?? "Select a conversation"}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
              {data.selectedConversation
                ? data.selectedConversation.enrollment.course.name
                : "Select an active-semester course"}
          </p>
          {data.selectedConversation ? (
            <p className="mt-1 inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Course scoped
            </p>
          ) : null}
        </div>
          </div>
          <AiChatClient
            key={selectedId ?? "new"}
            conversationId={selectedId}
            enrollmentId={data.selectedConversation?.enrollmentId ?? null}
            courseLabel={data.selectedConversation?.enrollment.course.name ?? null}
            initialMessages={(data.selectedConversation?.messages ?? []).map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt.toISOString(),
            }))}
            isConfigured={data.isConfigured}
            remainingMessages={Math.max(data.dailyLimit - data.usedToday, 0)}
            materialUpload={data.selectedConversation ? {
              semesterId: data.activeSemester.id,
              courseId: data.selectedConversation.enrollment.courseId,
              topics: data.selectedConversation.enrollment.courseTopics,
            } : null}
          />
        </section>
      </div>
    </AppShell>
  );
}
