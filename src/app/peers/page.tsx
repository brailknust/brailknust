import {
  ArrowRight,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/features/auth/queries";
import { getPeersPageData } from "@/features/peers/queries";

// Study groups and the Q&A board are withheld from the deployed peers page
// for now — the actions/queries/QaBoard component stay in place to bring
// this back later (see the "matches"-only view below).
type PeersPageProps = {
  searchParams: Promise<{ q?: string; course?: string }>;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function levelLabel(level: string | null) {
  return level ? `Level ${level.replace("LEVEL_", "")}` : "Level not set";
}

export default async function PeersPage({ searchParams }: PeersPageProps) {
  const { appUser } = await requireAppUser();
  const params = await searchParams;
  const data = await getPeersPageData(appUser.id, {
    search: params.q,
    courseId: params.course,
  });

  if (!data.activeSemester) {
    return (
      <AppShell title="Peers" eyebrow="Collaboration">
        <section className="rounded-2xl border border-border bg-white p-6">
          <Users className="h-6 w-6 text-accent" />
          <h2 className="mt-5 text-xl font-semibold">Set an active semester first</h2>
          <p className="mt-2 text-sm text-muted">Peer matches use your active-semester courses.</p>
          <a href="/academics" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
            Choose a semester <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </AppShell>
    );
  }

  const level = levelLabel(data.profile?.level ?? null);

  return (
    <AppShell title="Peers" eyebrow="Collaboration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/65">Active semester</p>
            <h2 className="mt-2 text-2xl font-semibold">{level} - {data.activeSemester.name}</h2>
            <p className="mt-2 text-sm text-white/70">{data.activeSemester.academicYear}</p>
          </div>
          <div className="min-w-20 rounded-xl bg-white/10 p-3 text-center">
            <p className="text-xl font-semibold">{data.peers.length}</p>
            <p className="text-xs text-white/60">Peers</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Students in your courses</h2>
            <p className="mt-1 text-sm text-muted">{data.courses.length} active-semester courses compared</p>
          </div>
          <Users className="h-5 w-5 text-accent" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {data.peers.length ? data.peers.map((peer) => (
            <article key={peer.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--accent-strong)] text-sm font-semibold text-white">
                  {initials(peer.fullName)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">{peer.fullName}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {levelLabel(peer.level)}{peer.programme ? ` / ${peer.programme}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase text-muted">Shared courses</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {peer.sharedCourses.map((course) => (
                    <span key={course.id} className="rounded-xl border border-border bg-white px-2.5 py-1.5 text-xs font-semibold">
                      {course.name}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center md:col-span-2">
              <Users className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-3 font-semibold">No shared-course peers yet</p>
              <p className="mt-1 text-sm text-muted">Matches appear when another student uses the same semester and courses.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
