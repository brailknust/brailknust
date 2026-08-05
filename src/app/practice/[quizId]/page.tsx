import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireAppUser } from "@/features/auth/queries";
import { saveDiagnosticFeedback, submitDiagnosticQuiz } from "@/features/diagnostics/actions";
import { prisma } from "@/server/db";

export default async function DiagnosticQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { appUser } = await requireAppUser();
  const quiz = await prisma.diagnosticQuiz.findFirst({
    where: { id: quizId, userId: appUser.id },
    include: {
      enrollment: { include: { course: true } },
      questions: {
        include: { attempts: { where: { userId: appUser.id }, take: 1 } },
        orderBy: { position: "asc" },
      },
      feedback: { where: { userId: appUser.id } },
    },
  });
  if (!quiz) notFound();
  const completed = quiz.status === "COMPLETED";

  return (
    <AppShell title={quiz.title} eyebrow="Diagnostic">
      <Link href="/practice" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to practice
      </Link>
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <p className="text-sm text-white/60">{quiz.enrollment.course.code} - {quiz.enrollment.course.name}</p>
        <h2 className="mt-2 text-2xl font-semibold">{quiz.title}</h2>
        {completed ? <p className="mt-3 text-lg font-semibold">Score: {quiz.score}/{quiz.maxScore}</p> : <p className="mt-2 text-sm text-white/70">Answer every question before submitting.</p>}
      </section>

      <form action={submitDiagnosticQuiz} className="mt-6 grid gap-5">
        <input type="hidden" name="quizId" value={quiz.id} />
        {quiz.questions.map((question, index) => {
          const options = Array.isArray(question.options) ? question.options.map(String) : [];
          const attempt = question.attempts[0];
          return (
            <fieldset key={question.id} className="rounded-2xl border border-border bg-white p-5" disabled={completed}>
              <legend className="px-2 text-sm font-semibold text-muted">Question {index + 1} · {question.difficulty.toLowerCase()}</legend>
              <p className="mt-2 font-semibold leading-7">{question.prompt}</p>
              <div className="mt-4 grid gap-3">
                {options.map((option, optionIndex) => {
                  const letter = String.fromCharCode(65 + optionIndex);
                  const isSelected = attempt?.selectedAnswer === letter;
                  const isCorrect = question.correctAnswer === letter;
                  return (
                    <label key={letter} className={`flex gap-3 rounded-xl border p-3 text-sm ${completed && isCorrect ? "border-green-400 bg-green-50" : completed && isSelected ? "border-red-300 bg-red-50" : "border-border bg-surface"}`}>
                      <input type="radio" name={`answer_${question.id}`} value={letter} required defaultChecked={isSelected} />
                      <span><span className="font-semibold">{letter}.</span> {option}</span>
                    </label>
                  );
                })}
              </div>
              {completed ? (
                <div className="mt-4 border-t border-border pt-4">
                  <p className={`flex items-center gap-2 text-sm font-semibold ${attempt?.isCorrect ? "text-green-700" : "text-red-700"}`}>
                    {attempt?.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {attempt?.isCorrect ? "Correct" : `Correct answer: ${question.correctAnswer}`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">{question.explanation}</p>
                </div>
              ) : null}
            </fieldset>
          );
        })}
        {!completed ? <PendingSubmitButton pendingLabel="Submitting diagnostic..." className="h-12 rounded-xl bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white">Submit diagnostic</PendingSubmitButton> : null}
      </form>
      {completed ? (
        <section className="mt-6 rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">How useful was this diagnostic?</h2>
          <form action={saveDiagnosticFeedback} className="mt-4 grid gap-3">
            <input type="hidden" name="quizId" value={quiz.id} />
            <label className="text-sm font-medium" htmlFor="diagnostic-rating">Rating</label>
            <select id="diagnostic-rating" name="rating" defaultValue={quiz.feedback?.rating ?? 5} className="h-11 rounded-xl border border-border bg-white px-3 text-sm">
              <option value="5">Very useful</option>
              <option value="4">Useful</option>
              <option value="3">Neutral</option>
              <option value="2">Not very useful</option>
              <option value="1">Not useful</option>
            </select>
            <label className="text-sm font-medium" htmlFor="diagnostic-feedback">Optional note</label>
            <textarea id="diagnostic-feedback" name="comment" maxLength={1000} defaultValue={quiz.feedback?.comment ?? ""} className="min-h-24 rounded-xl border border-border bg-white px-3 py-2 text-sm" />
            <PendingSubmitButton pendingLabel="Saving feedback..." className="h-11 justify-self-start rounded-xl border border-border px-4 text-sm font-semibold">Save feedback</PendingSubmitButton>
          </form>
        </section>
      ) : null}
    </AppShell>
  );
}
