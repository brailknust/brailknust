import Link from "next/link";
import { ArrowUp, MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  deletePeerAnswer,
  deletePeerQuestion,
  savePeerAnswer,
  savePeerQuestion,
  togglePeerQuestionVote,
} from "@/features/peers/actions";
import type { getPeersPageData } from "@/features/peers/queries";

type PeersData = Awaited<ReturnType<typeof getPeersPageData>>;
type QaBoardProps = {
  courses: PeersData["courses"];
  questions: PeersData["questions"];
  search?: string;
  courseId?: string;
};

const fieldClassName = "h-11 w-full rounded-md border border-border bg-background px-3 text-sm";

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function QaBoard({ courses, questions, search, courseId }: QaBoardProps) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="self-start rounded-lg border border-border bg-background p-5">
        <div className="flex items-center gap-3">
          <Plus className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Ask a question</h2>
        </div>
        <form action={savePeerQuestion} className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Title
            <input name="title" required minLength={8} maxLength={200} placeholder="How should I approach this topic?" className={fieldClassName} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Course
            <select name="courseId" defaultValue="" className={fieldClassName}>
              <option value="">General semester question</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Details
            <textarea name="body" required minLength={20} maxLength={5000} placeholder="Include what you have tried and where you are stuck." className="min-h-32 rounded-md border border-border bg-background px-3 py-3 text-sm" />
          </label>
          <PendingSubmitButton pendingLabel="Posting..." className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            <Plus className="h-4 w-4" /> Post question
          </PendingSubmitButton>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Questions and answers</h2>
            <p className="mt-1 text-sm text-muted">{questions.length} questions shown</p>
          </div>
          <MessageCircle className="h-5 w-5 text-accent" />
        </div>

        <form action="/peers" method="get" className="mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[1fr_220px_auto]">
          <input type="hidden" name="view" value="qa" />
          <label className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
            <input name="q" defaultValue={search} maxLength={100} placeholder="Search questions" className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm" />
          </label>
          <select name="course" defaultValue={courseId ?? ""} className={fieldClassName}>
            <option value="">All my courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
        {search || courseId ? (
          <Link href="/peers?view=qa" className="mt-3 inline-flex text-sm font-semibold text-accent">Clear filters</Link>
        ) : null}

        <div className="mt-5 grid gap-4">
          {questions.length ? questions.map((question) => (
            <article key={question.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex gap-4">
                <form action={togglePeerQuestionVote} className="shrink-0">
                  <input type="hidden" name="questionId" value={question.id} />
                  <button
                    aria-label={question.isVoted ? "Remove vote" : "Vote for question"}
                    title={question.isVoted ? "Remove vote" : "Vote for question"}
                    className={`grid min-h-16 w-11 place-items-center rounded-md border text-sm font-semibold ${
                      question.isVoted
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    <ArrowUp className="h-4 w-4" />
                    <span>{question.voteCount}</span>
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {question.course ? <span className="rounded-md border border-border bg-background px-2 py-1 font-semibold">{question.course.name}</span> : <span>General</span>}
                    <span>by {question.author.fullName}</span>
                    <span>{dateLabel(question.createdAt)}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{question.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{question.body}</p>
                </div>
              </div>

              {question.isOwner ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <details className="flex-1">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
                      <Pencil className="h-4 w-4" /> Edit question
                    </summary>
                    <form action={savePeerQuestion} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={question.id} />
                      <input name="title" required minLength={8} maxLength={200} defaultValue={question.title} className={fieldClassName} />
                      <select name="courseId" defaultValue={question.courseId ?? ""} className={fieldClassName}>
                        <option value="">General semester question</option>
                        {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                      </select>
                      <textarea name="body" required minLength={20} maxLength={5000} defaultValue={question.body} className="min-h-28 rounded-md border border-border bg-background px-3 py-3 text-sm" />
                      <PendingSubmitButton pendingLabel="Saving..." className="h-10 w-fit rounded-md bg-foreground px-4 text-sm font-semibold text-background">Save changes</PendingSubmitButton>
                    </form>
                  </details>
                  <form action={deletePeerQuestion}>
                    <input type="hidden" name="questionId" value={question.id} />
                    <ConfirmSubmitButton
                      message={`Delete "${question.title}" and every answer?`}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-red-300 px-3 text-sm font-semibold text-red-600"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : null}

              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-sm font-semibold">{question.answers.length} answers</h4>
                <div className="mt-3 grid gap-3">
                  {question.answers.map((answer) => (
                    <div key={answer.id} className="rounded-md border border-border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{answer.author.fullName}</p>
                        <p className="text-xs text-muted">{dateLabel(answer.createdAt)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{answer.body}</p>
                      {answer.isOwner ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <details className="flex-1">
                            <summary className="cursor-pointer text-xs font-semibold text-accent">Edit answer</summary>
                            <form action={savePeerAnswer} className="mt-3 grid gap-2">
                              <input type="hidden" name="id" value={answer.id} />
                              <input type="hidden" name="questionId" value={question.id} />
                              <textarea name="body" required maxLength={5000} defaultValue={answer.body} className="min-h-24 rounded-md border border-border bg-surface px-3 py-3 text-sm" />
                              <PendingSubmitButton pendingLabel="Saving..." className="h-9 w-fit rounded-md bg-foreground px-3 text-xs font-semibold text-background">Save answer</PendingSubmitButton>
                            </form>
                          </details>
                          <form action={deletePeerAnswer}>
                            <input type="hidden" name="answerId" value={answer.id} />
                            <input type="hidden" name="questionId" value={question.id} />
                            <ConfirmSubmitButton
                              message="Delete this answer permanently?"
                              className="grid h-8 w-8 place-items-center rounded-md border border-red-300 text-red-600"
                              aria-label="Delete answer"
                              title="Delete answer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <form action={savePeerAnswer} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <input type="hidden" name="questionId" value={question.id} />
                  <label className="grid flex-1 gap-2 text-sm font-medium">
                    Add answer
                    <textarea name="body" required minLength={2} maxLength={5000} rows={2} placeholder="Write a useful answer" className="min-h-20 rounded-md border border-border bg-background px-3 py-3 text-sm" />
                  </label>
                  <PendingSubmitButton pendingLabel="Posting..." className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Post answer</PendingSubmitButton>
                </form>
              </div>
            </article>
          )) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <MessageCircle className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-3 font-semibold">No matching questions</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
