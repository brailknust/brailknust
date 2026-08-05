import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LogOut,
  MapPin,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireAppUser } from "@/features/auth/queries";
import {
  createStudyGroup,
  deleteStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  updateStudyGroup,
} from "@/features/peers/actions";
import { QaBoard } from "@/features/peers/qa-board";
import { getPeersPageData } from "@/features/peers/queries";

type PeersPageProps = {
  searchParams: Promise<{ view?: string; q?: string; course?: string }>;
};

const fieldClassName = "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm";

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

function meetingLabel(value: Date | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function PeersPage({ searchParams }: PeersPageProps) {
  const { appUser } = await requireAppUser();
  const params = await searchParams;
  const view = params.view === "groups" || params.view === "qa" ? params.view : "matches";
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
          <p className="mt-2 text-sm text-muted">Peer matches and groups use your active-semester courses.</p>
          <Link href="/academics" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
            Choose a semester <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </AppShell>
    );
  }

  const level = levelLabel(data.profile?.level ?? null);
  const joinedGroups = data.groups.filter((group) => group.isMember).length;

  return (
    <AppShell title="Peers" eyebrow="Collaboration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/65">Active semester</p>
            <h2 className="mt-2 text-2xl font-semibold">{level} - {data.activeSemester.name}</h2>
            <p className="mt-2 text-sm text-white/70">{data.activeSemester.academicYear}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Peers", data.peers.length],
              ["Groups", data.groups.length],
              ["Joined", joinedGroups],
              ["Questions", data.questions.length],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 rounded-xl bg-white/10 p-3 text-center">
                <p className="text-xl font-semibold">{value}</p>
                <p className="text-xs text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-2 border-b border-border" aria-label="Peer views">
        {[
          ["matches", "Study matches"],
          ["groups", "Study groups"],
          ["qa", "Q&A board"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={key === "matches" ? "/peers" : `/peers?view=${key}`}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              view === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {view === "matches" ? (
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
      ) : view === "groups" ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <section className="self-start rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Create study group</h2>
            </div>
            <form action={createStudyGroup} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Group name
                <input name="name" required maxLength={120} placeholder="Digital systems study circle" className={fieldClassName} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Course
                <select name="courseId" required defaultValue="" className={fieldClassName}>
                  <option value="" disabled>Select a course</option>
                  {data.courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Description
                <textarea name="description" maxLength={500} placeholder="Topics and focus" className="min-h-24 rounded-xl border border-border bg-white px-3 py-3 text-sm" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Next meeting
                  <input name="meetingAt" type="datetime-local" className={fieldClassName} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Member limit
                  <input name="maxMembers" type="number" min="2" max="100" defaultValue="10" required className={fieldClassName} />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Meeting place or link
                <input name="meetingPlace" maxLength={200} placeholder="Engineering library" className={fieldClassName} />
              </label>
              <PendingSubmitButton pendingLabel="Creating group..." className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" /> Create group
              </PendingSubmitButton>
            </form>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Active-semester groups</h2>
                <p className="mt-1 text-sm text-muted">Groups are available only to students enrolled in their course.</p>
              </div>
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div className="mt-5 grid gap-4">
              {data.groups.length ? data.groups.map((group) => (
                <article key={group.id} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                        <span className="rounded-xl border border-border bg-white px-2 py-1">{group.course.name}</span>
                        <span>{group.members.length}/{group.maxMembers} members</span>
                        {group.isOwner ? <span className="text-accent">You own this group</span> : group.isMember ? <span className="text-accent">Joined</span> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">{group.name}</h3>
                      {group.description ? <p className="mt-2 text-sm leading-6 text-muted">{group.description}</p> : null}
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-accent" />
                      <div><p className="text-xs text-muted">Next meeting</p><p className="mt-1 text-sm font-semibold">{meetingLabel(group.meetingAt)}</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-accent" />
                      <div><p className="text-xs text-muted">Place</p><p className="mt-1 text-sm font-semibold">{group.meetingPlace ?? "Not set"}</p></div>
                    </div>
                  </div>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-accent">Members ({group.members.length})</summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.members.map((member) => (
                        <span key={member.userId} className="rounded-xl border border-border bg-white px-2.5 py-1.5 text-xs">
                          {member.user.fullName}{member.role === "owner" ? " / Owner" : ""}
                        </span>
                      ))}
                    </div>
                  </details>

                  {group.isOwner ? (
                    <details className="mt-4 border-t border-border pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-accent">Edit group</summary>
                      <form action={updateStudyGroup} className="mt-4 grid gap-4">
                        <input type="hidden" name="groupId" value={group.id} />
                        <label className="grid gap-2 text-sm font-medium">
                          Group name
                          <input name="name" required maxLength={120} defaultValue={group.name} className={fieldClassName} />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Description
                          <textarea name="description" maxLength={500} defaultValue={group.description ?? ""} className="min-h-24 rounded-xl border border-border bg-white px-3 py-3 text-sm" />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2 text-sm font-medium">
                            Next meeting
                            <input name="meetingAt" type="datetime-local" defaultValue={group.meetingAt?.toISOString().slice(0, 16)} className={fieldClassName} />
                          </label>
                          <label className="grid gap-2 text-sm font-medium">
                            Member limit
                            <input name="maxMembers" type="number" min={group.members.length} max="100" defaultValue={group.maxMembers} required className={fieldClassName} />
                          </label>
                        </div>
                        <label className="grid gap-2 text-sm font-medium">
                          Meeting place or link
                          <input name="meetingPlace" maxLength={200} defaultValue={group.meetingPlace ?? ""} className={fieldClassName} />
                        </label>
                        <PendingSubmitButton pendingLabel="Saving..." className="h-10 w-fit rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Save changes</PendingSubmitButton>
                      </form>
                    </details>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {!group.isMember ? (
                      <form action={joinStudyGroup}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <PendingSubmitButton disabled={group.isFull} pendingLabel="Joining..." className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                          <UserPlus className="h-4 w-4" /> {group.isFull ? "Group full" : "Join group"}
                        </PendingSubmitButton>
                      </form>
                    ) : !group.isOwner ? (
                      <form action={leaveStudyGroup}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <PendingSubmitButton pendingLabel="Leaving..." className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted hover:text-foreground">
                          <LogOut className="h-4 w-4" /> Leave group
                        </PendingSubmitButton>
                      </form>
                    ) : null}
                    {group.isOwner ? (
                      <form action={deleteStudyGroup} className="ml-auto">
                        <input type="hidden" name="groupId" value={group.id} />
                        <ConfirmSubmitButton
                          message={`Delete "${group.name}" and remove all memberships?`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-600"
                        >
                          <Trash2 className="h-4 w-4" /> Delete group
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <Users className="mx-auto h-6 w-6 text-accent" />
                  <p className="mt-3 font-semibold">No study groups for this semester</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <QaBoard
          courses={data.courses}
          questions={data.questions}
          search={params.q}
          courseId={params.course}
        />
      )}
    </AppShell>
  );
}
