import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createPlatformTopic,
  deletePlatformTopic,
  deletePlatformMaterial,
  mergePlatformTopics,
  togglePlatformTopicArchive,
  updatePlatformTopic,
} from "@/features/admin/actions";
import { PlatformUpload } from "@/features/admin/platform-upload";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

export default async function AdminCourseTopicsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireAdmin();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      platformTopics: {
        include: {
          materialLinks: {
            include: {
              material: {
                include: { _count: { select: { chunks: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { materials: true, materialLinks: true, chunks: true, diagnosticQuestions: true, topicMasteries: true } },
        },
        orderBy: [{ sequence: "asc" }, { title: "asc" }],
      },
    },
  });
  if (!course) notFound();

  return (
    <AppShell title={`${course.code} course outline`} eyebrow="Administration">
      <Link href="/admin/content" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted">
        <ArrowLeft className="h-4 w-4" /> Back to platform library
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
      <form action={createPlatformTopic} className="grid content-start gap-3 rounded-2xl border border-border bg-white p-5">
        <input type="hidden" name="courseId" value={course.id} />
        <h2 className="text-lg font-semibold">Add official topic</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          <input name="title" required maxLength={120} placeholder="Topic title" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
          <input name="sequence" type="number" min="0" max="999" defaultValue={course.platformTopics.length} aria-label="Order" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
        </div>
        <textarea name="description" maxLength={1000} rows={2} placeholder="Topic description" className="rounded-xl border border-border bg-white p-3 text-sm" />
        <textarea name="learningOutcomes" maxLength={3000} rows={3} placeholder="Learning outcomes, one per line" className="rounded-xl border border-border bg-white p-3 text-sm" />
        <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Add topic</button>
      </form>
      <PlatformUpload
        course={{ id: course.id, code: course.code, name: course.name }}
        topics={course.platformTopics
          .filter((topic) => !topic.isArchived)
          .map((topic) => ({ id: topic.id, title: topic.title }))}
      />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Outline topics and materials</h2>
        <p className="mt-1 text-sm text-muted">Every published material appears beneath its selected topic.</p>
      <div className="mt-4 grid gap-4">
        {course.platformTopics.map((topic) => (
          <article key={topic.id} className={`rounded-2xl border border-border bg-white p-5 ${topic.isArchived ? "opacity-60" : ""}`}>
            <form action={updatePlatformTopic} className="grid gap-3">
              <input type="hidden" name="id" value={topic.id} />
              <input type="hidden" name="courseId" value={course.id} />
              <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
                <input name="title" required maxLength={120} defaultValue={topic.title} className="h-11 rounded-xl border border-border bg-white px-3 font-semibold" />
                <input name="sequence" type="number" min="0" max="999" defaultValue={topic.sequence} aria-label="Order" className="h-11 rounded-xl border border-border bg-white px-3 text-sm" />
              </div>
              <textarea name="description" maxLength={1000} rows={2} defaultValue={topic.description ?? ""} placeholder="Description" className="rounded-xl border border-border bg-white p-3 text-sm" />
              <textarea name="learningOutcomes" maxLength={3000} rows={3} defaultValue={topic.learningOutcomes ?? ""} placeholder="Learning outcomes, one per line" className="rounded-xl border border-border bg-white p-3 text-sm" />
              <p className="text-xs text-muted">{topic._count.materialLinks} materials · {topic._count.chunks} chunks · {topic._count.diagnosticQuestions} questions</p>
              <button className="h-10 rounded-xl border border-border px-4 text-sm font-semibold">Save changes</button>
            </form>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Topic materials</p>
              <div className="mt-2 grid gap-2">
                {topic.materialLinks.length ? topic.materialLinks.map(({ material }) => (
                  <div key={material.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface p-3">
                    <div>
                      <p className="text-sm font-semibold">{material.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {material.type.toLowerCase()} · {material.status.toLowerCase()} · {material._count.chunks} chunks
                      </p>
                      {material.errorMessage ? <p className="mt-1 text-xs text-red-600">{material.errorMessage}</p> : null}
                    </div>
                    <form action={deletePlatformMaterial}>
                      <input type="hidden" name="id" value={material.id} />
                      <ConfirmSubmitButton
                        message={`Delete "${material.title}"?`}
                        className="rounded-xl border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-muted"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                )) : <p className="text-xs text-muted">No material uploaded under this topic.</p>}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <form action={togglePlatformTopicArchive}>
                <input type="hidden" name="id" value={topic.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="isArchived" value={String(topic.isArchived)} />
                <button className="h-10 w-full rounded-xl border border-border px-4 text-sm font-semibold">{topic.isArchived ? "Restore" : "Archive"}</button>
              </form>
              {course.platformTopics.length > 1 ? (
                <form action={mergePlatformTopics} className="flex gap-2">
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="sourceId" value={topic.id} />
                  <select name="targetId" required defaultValue="" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-white px-2 text-xs">
                    <option value="" disabled>Merge into…</option>
                    {course.platformTopics.filter((other) => other.id !== topic.id).map((other) => <option key={other.id} value={other.id}>{other.title}</option>)}
                  </select>
                  <button className="h-10 rounded-xl border border-border px-3 text-xs font-semibold">Merge</button>
                </form>
              ) : null}
            </div>
            <div className="mt-3 border-t border-border pt-3">
              {topic._count.materials === 0
              && topic._count.materialLinks === 0
              && topic._count.diagnosticQuestions === 0
              && topic._count.topicMasteries === 0 ? (
                <form action={deletePlatformTopic}>
                  <input type="hidden" name="id" value={topic.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <ConfirmSubmitButton
                    message={`Permanently delete the topic "${topic.title}"?`}
                    className="h-9 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete topic
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <p className="text-xs text-muted">
                  To delete this topic, first remove its materials and diagnostic history. You can archive or merge it without losing student records.
                </p>
              )}
            </div>
          </article>
        ))}
        {!course.platformTopics.length ? <p className="rounded-2xl border border-border p-5 text-sm text-muted">No official topics yet.</p> : null}
      </div>
      </section>
    </AppShell>
  );
}
