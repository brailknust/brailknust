import Link from "next/link";
import { ArrowRight, BookOpen, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

export default async function AdminContentPage() {
  await requireAdmin();
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { platformTopics: true, platformMaterials: true } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <AppShell title="Platform course library" eyebrow="Administration">
      <section className="mb-6 rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Shared academic content</h2>
        <p className="mt-2 text-sm text-white/70">
          Build each official course outline, then publish materials beneath the relevant topic.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Course outlines</h2>
            <p className="mt-1 text-sm text-muted">Open a course to manage its ordered topics and topic materials.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/admin/content/${course.id}/topics`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-foreground"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-accent">{course.code}</span>
                <span className="mt-1 block truncate text-sm font-semibold">{course.name}</span>
                <span className="mt-2 block text-xs text-muted">
                  {course._count.platformTopics} topics · {course._count.platformMaterials} materials
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          ))}
          {!courses.length ? <p className="text-sm text-muted">No courses are available yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
