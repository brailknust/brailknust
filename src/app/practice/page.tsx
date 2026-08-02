import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/features/auth/queries";
import { PracticeGenerator } from "@/features/diagnostics/practice-generator";
import { prisma } from "@/server/db";

export default async function PracticePage() {
  const { appUser } = await requireAppUser();
  const semesterId = appUser.activeSemesterId;

  if (!semesterId) {
    return (
      <AppShell title="Diagnostic practice" eyebrow="Learning">
        <p className="rounded-2xl border border-border p-5 text-sm text-muted">Set an active semester before generating practice.</p>
      </AppShell>
    );
  }

  const [enrollments, quizzes, masteries] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: appUser.id, semesterId },
      include: {
        course: {
          select: {
            code: true,
            name: true,
            platformTopics: {
              where: { isArchived: false },
              include: { _count: { select: { chunks: true } } },
              orderBy: [{ sequence: "asc" }, { title: "asc" }],
            },
          },
        },
        courseTopics: {
          include: { _count: { select: { chunks: true } } },
          orderBy: [{ sequence: "asc" }, { title: "asc" }],
        },
      },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.diagnosticQuiz.findMany({
      where: { userId: appUser.id, enrollment: { semesterId } },
      include: {
        enrollment: { include: { course: { select: { code: true, name: true } } } },
        questions: { select: { topic: { select: { title: true } }, platformTopic: { select: { title: true } } }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.topicMastery.findMany({
      where: { userId: appUser.id, enrollment: { semesterId } },
      include: {
        topic: { select: { title: true } },
        platformTopic: { select: { title: true } },
        enrollment: { include: { course: { select: { code: true } } } },
      },
      orderBy: { masteryScore: "asc" },
    }),
  ]);

  return (
    <AppShell title="Diagnostic practice" eyebrow="Learning">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <BrainCircuit className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Find what needs more work</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          Take material-grounded topic quizzes. Results update mastery and identify weak areas after enough evidence is collected.
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <PracticeGenerator
          enrollments={enrollments.map((enrollment) => ({
            id: enrollment.id,
            course: enrollment.course,
            topics: [
              ...enrollment.course.platformTopics.map((topic) => ({
                id: topic.id,
                title: topic.title,
                chunkCount: topic._count.chunks,
                source: "Platform" as const,
              })),
              ...enrollment.courseTopics.map((topic) => ({
              id: topic.id,
              title: topic.title,
              chunkCount: topic._count.chunks,
                source: "Private" as const,
              })),
            ],
          }))}
        />

        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Topic mastery</h2>
          <div className="mt-4 grid gap-3">
            {masteries.length ? masteries.map((mastery) => (
              <div key={mastery.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{mastery.platformTopic?.title ?? mastery.topic?.title ?? "Topic"}</p>
                    <p className="mt-1 text-xs text-muted">{mastery.enrollment.course.code} · {mastery.correctCount}/{mastery.attemptCount} correct</p>
                  </div>
                  <span className="text-lg font-semibold">{mastery.masteryScore.toString()}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(Number(mastery.masteryScore), 100)}%` }} />
                </div>
              </div>
            )) : <p className="text-sm text-muted">Complete a diagnostic to calculate topic mastery.</p>}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold">Recent diagnostics</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {quizzes.length ? quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/practice/${quiz.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 hover:border-foreground">
              <div>
                <p className="font-semibold">{quiz.title}</p>
                <p className="mt-1 text-sm text-muted">{quiz.enrollment.course.code} · {quiz.status.toLowerCase()}</p>
                {quiz.status === "COMPLETED" ? <p className="mt-1 text-sm font-semibold">{quiz.score}/{quiz.maxScore}</p> : null}
              </div>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )) : <p className="text-sm text-muted">No diagnostics generated yet.</p>}
        </div>
      </section>
    </AppShell>
  );
}
