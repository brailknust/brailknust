import Link from "next/link";
import { ArrowRight, BookOpen, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { knustCurricula } from "@/data/curricula";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

function programmeContentKey(template: (typeof knustCurricula)[number]) {
  return `${template.college}|${template.department}|${template.program}|${template.version}`;
}

type AdminContentPageProps = {
  searchParams: Promise<{
    programme?: string;
  }>;
};

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  await requireAdmin();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [rawSearchParams, courses, aiUsage, failedIngestionCount, pendingIngestionCount] = await Promise.all([
    searchParams,
    prisma.course.findMany({
      where: { approvalStatus: "OFFICIAL" },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { platformTopics: true, platformMaterials: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.aiUsageEvent.aggregate({
      where: { createdAt: { gte: dayStart } },
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
    prisma.materialIngestionAttempt.count({ where: { status: "FAILED" } }),
    prisma.materialIngestionAttempt.count({ where: { status: "PENDING" } }),
  ]);
  const coursesByCode = new Map(courses.map((course) => [course.code, course]));
  const assignedCourseIds = new Set<string>();
  const programmeCourseGroups = [...knustCurricula.reduce((groups, template) => {
    const key = programmeContentKey(template);
    const existing = groups.get(key);
    const group = existing ?? {
      key,
      college: template.college,
      department: template.department,
      programme: template.program,
      version: template.version,
      templates: [] as typeof knustCurricula,
    };

    group.templates.push(template);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; college: string; department: string; programme: string; version: string; templates: typeof knustCurricula }>()).values()]
    .map((group) => {
      const courseCodes = [...new Set(group.templates.flatMap((template) => template.courses.map((course) => course.code)))].sort();
      const groupedCourses = courseCodes.flatMap((code) => {
        const course = coursesByCode.get(code);
        if (!course) return [];
        assignedCourseIds.add(course.id);
        return [course];
      });

      return { ...group, courses: groupedCourses };
    })
    .filter((group) => group.courses.length > 0)
    .sort((a, b) => `${a.college} ${a.programme} ${a.version}`.localeCompare(`${b.college} ${b.programme} ${b.version}`));
  const unassignedOutlineCourses = courses.filter((course) => !assignedCourseIds.has(course.id));
  const selectedProgrammeGroup = programmeCourseGroups.find((group) => group.key === rawSearchParams.programme);

  return (
    <AppShell title="Platform course library" eyebrow="Administration">
      <section className="mb-6 rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Shared academic content</h2>
        <p className="mt-2 text-sm text-white/70">
          Build each official course outline, then publish materials beneath the relevant topic.
        </p>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI operations today</p>
          <p className="mt-2 text-2xl font-semibold">{aiUsage._count._all}</p>
          <p className="mt-1 text-xs text-muted">{aiUsage._sum.totalTokens ?? 0} estimated tokens</p>
        </div>
        <div className="border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Failed processing</p>
          <p className="mt-2 text-2xl font-semibold">{failedIngestionCount}</p>
          <p className="mt-1 text-xs text-muted">Materials awaiting retry or replacement</p>
        </div>
        <div className="border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Processing now</p>
          <p className="mt-2 text-2xl font-semibold">{pendingIngestionCount}</p>
          <p className="mt-1 text-xs text-muted">Uploads being ingested</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Course outlines</h2>
            <p className="mt-1 text-sm text-muted">Open a programme to manage course outlines beneath it.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {selectedProgrammeGroup ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <Link href="/admin/content" className="text-xs font-semibold text-accent hover:underline">← Back to course outline programmes</Link>
                  <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-accent">{selectedProgrammeGroup.college}</span>
                  <span className="mt-1 block text-xl font-semibold">{selectedProgrammeGroup.programme}</span>
                  <span className="mt-1 block text-xs text-muted">{selectedProgrammeGroup.department} · {selectedProgrammeGroup.version}</span>
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted">
                  {selectedProgrammeGroup.courses.length} course outlines
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedProgrammeGroup.courses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/admin/content/${course.id}/topics`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 transition-colors hover:border-foreground"
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
              </div>
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programmeCourseGroups.map((group) => (
                <article key={group.key} className="rounded-2xl border border-border bg-white p-5 transition hover:border-foreground">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">{group.college}</p>
                    <h2 className="mt-2 text-lg font-semibold">{group.programme}</h2>
                    <p className="mt-1 text-sm text-muted">{group.department}</p>
                    <p className="mt-1 text-xs text-muted">{group.version}</p>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Courses</p>
                      <p className="mt-2 font-semibold">{group.courses.length}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Topics</p>
                      <p className="mt-2 font-semibold">{group.courses.reduce((sum, course) => sum + course._count.platformTopics, 0)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Materials</p>
                      <p className="mt-2 font-semibold">{group.courses.reduce((sum, course) => sum + course._count.platformMaterials, 0)}</p>
                    </div>
                  </div>
                  <Link href={`/admin/content?programme=${encodeURIComponent(group.key)}`} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                    Open programme
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
              {unassignedOutlineCourses.length ? (
                <article className="rounded-2xl border border-border bg-white p-5 transition hover:border-foreground">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Other official courses</p>
                  <h2 className="mt-2 text-lg font-semibold">Unassigned course outlines</h2>
                  <p className="mt-1 text-sm text-muted">{unassignedOutlineCourses.length} course outlines</p>
                </article>
              ) : null}
            </div>
          )}
          {!courses.length ? <p className="text-sm text-muted">No courses are available yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
