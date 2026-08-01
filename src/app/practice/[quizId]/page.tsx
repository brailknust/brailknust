import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/features/auth/queries";
import { submitDiagnosticQuiz } from "@/features/diagnostics/actions";
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
    },
  });
  if (!quiz) notFound();
  const completed = quiz.status === "COMPLETED";

  return (
    <AppShell title={quiz.title} eyebrow="Diagnostic">
      <Link href="/practice" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to practice
      </Link>
      <section className="rounded-lg bg-foreground p-5 text-background">
        <p className="text-sm text-background/60">{quiz.enrollment.course.code} - {quiz.enrollment.course.name}</p>
        <h2 className="mt-2 text-2xl font-semibold">{quiz.title}</h2>
        {completed ? <p className="mt-3 text-lg font-semibold">Score: {quiz.score}/{quiz.maxScore}</p> : <p className="mt-2 text-sm text-background/70">Answer every question before submitting.</p>}
      </section>

      <form action={submitDiagnosticQuiz} className="mt-6 grid gap-5">
        <input type="hidden" name="quizId" value={quiz.id} />
        {quiz.questions.map((question, index) => {
          const options = Array.isArray(question.options) ? question.options.map(String) : [];
          const attempt = question.attempts[0];
          return (
            <fieldset key={question.id} className="rounded-lg border border-border bg-background p-5" disabled={completed}>
              <legend className="px-2 text-sm font-semibold text-muted">Question {index + 1} · {question.difficulty.toLowerCase()}</legend>
              <p className="mt-2 font-semibold leading-7">{question.prompt}</p>
              <div className="mt-4 grid gap-3">
                {options.map((option, optionIndex) => {
                  const letter = String.fromCharCode(65 + optionIndex);
                  const isSelected = attempt?.selectedAnswer === letter;
                  const isCorrect = question.correctAnswer === letter;
                  return (
                    <label key={letter} className={`flex gap-3 rounded-md border p-3 text-sm ${completed && isCorrect ? "border-green-400 bg-green-50" : completed && isSelected ? "border-red-300 bg-red-50" : "border-border bg-surface"}`}>
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
        {!completed ? <button className="h-12 rounded-md bg-foreground px-5 text-sm font-semibold text-background">Submit diagnostic</button> : null}
      </form>
    </AppShell>
  );
}
