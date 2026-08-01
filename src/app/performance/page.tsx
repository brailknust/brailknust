import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Gauge, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireAppUser } from "@/features/auth/queries";
import { getPerformanceData } from "@/features/performance/queries";

const num = (value: unknown) => Number(value?.toString() ?? 0);
const pct = (value: unknown) => value === null || value === undefined ? "Not set" : `${num(value)}%`;
const rate = (done: number, total: number) => total ? Math.round(done / total * 100) : 0;

function Indicator({ label, value }: { label: string; value: unknown }) {
  const width = Math.min(Math.max(num(value), 0), 100);
  return <div><div className="flex justify-between text-xs text-muted"><span>{label}</span><span>{pct(value)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full bg-accent" style={{ width: `${width}%` }} /></div></div>;
}

export default async function PerformancePage() {
  const { appUser } = await requireAppUser();
  const data = await getPerformanceData(appUser.id);
  if (!data.activeSemester) return <AppShell title="Performance" eyebrow="Analytics"><section className="rounded-lg border border-border p-6"><BarChart3 className="h-6 w-6 text-accent" /><h2 className="mt-5 text-xl font-semibold">Set an active semester first</h2><p className="mt-2 text-sm text-muted">Performance is semester-specific so courses from different levels are not mixed.</p><Link href="/academics" className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background">Choose a semester <ArrowRight className="h-4 w-4" /></Link></section></AppShell>;

  const tasksDone = data.tasks.filter((x) => x.status === "DONE").length;
  const sessionsDone = data.studyItems.filter((x) => x.status === "DONE").length;
  const minutes = data.studyItems.filter((x) => x.status === "DONE").reduce((sum, x) => sum + (x.durationMinutes ?? 0), 0);
  const tracked = data.enrollments.reduce((sum, x) => sum + Number(Boolean(x.currentGrade)) + Number(x.attendance !== null) + Number(x.confidenceScore !== null), 0);
  const totalTracked = data.enrollments.length * 3;
  const level = data.profile?.level ? `Level ${data.profile.level.replace("LEVEL_", "")}` : "Level not set";
  const summaries = [
    ["Task completion", rate(tasksDone, data.tasks.length), `${tasksDone}/${data.tasks.length} complete`, CheckCircle2],
    ["Study completion", rate(sessionsDone, data.studyItems.length), `${sessionsDone}/${data.studyItems.length} complete`, Clock3],
    ["Data coverage", rate(tracked, totalTracked), `${tracked}/${totalTracked} recorded`, Gauge],
  ] as const;

  return <AppShell title="Performance" eyebrow="Analytics">
    <section className="rounded-lg border border-border bg-foreground p-5 text-background"><p className="text-sm uppercase text-background/65">Active semester</p><h2 className="mt-3 text-2xl font-semibold">{level} - {data.activeSemester.name}</h2><p className="mt-2 text-sm text-background/70">{data.activeSemester.academicYear}</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-background/10 p-4"><p className="text-2xl font-semibold">{pct(data.profile?.cwa)}</p><p className="text-xs text-background/60">Current CWA</p></div><div className="rounded-md bg-background/10 p-4"><p className="text-2xl font-semibold">{data.enrollments.length}</p><p className="text-xs text-background/60">Courses</p></div><div className="rounded-md bg-background/10 p-4"><p className="text-2xl font-semibold">{Math.round(minutes / 6) / 10}h</p><p className="text-xs text-background/60">Completed study</p></div></div></section>
    <section className="mt-6 grid gap-4 md:grid-cols-3">{summaries.map(([label, value, detail, Icon]) => <article key={label} className="rounded-lg border border-border bg-surface p-5"><div className="flex justify-between"><Icon className="h-5 w-5 text-accent" /><span className="text-2xl font-semibold">{value}%</span></div><h2 className="mt-6 font-semibold">{label}</h2><div className="mt-3 h-2 bg-background"><div className="h-full bg-accent" style={{ width: `${value}%` }} /></div><p className="mt-3 text-sm text-muted">{detail}</p></article>)}</section>
    <section className="mt-6 rounded-lg border border-border p-5"><div className="flex justify-between gap-4"><div><h2 className="text-lg font-semibold">Course performance</h2><p className="text-sm text-muted">Open a course to update its indicators.</p></div><Link href="/academics" className="text-sm font-semibold text-accent">Manage semester</Link></div><div className="mt-5 grid gap-3">{data.enrollments.length ? data.enrollments.map((e) => { const tasks = data.tasks.filter((x) => x.courseId === e.courseId); const sessions = data.studyItems.filter((x) => x.courseId === e.courseId); return <Link key={e.id} href={`/academics/semesters/${data.activeSemester!.id}/courses/${e.courseId}`} className="grid gap-4 rounded-md border border-border bg-surface p-4 hover:border-foreground md:grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_1fr_auto] md:items-center"><div><p className="font-semibold">{e.course.name}</p><p className="text-sm text-muted">{e.course.code}</p></div><div><p className="text-xs text-muted">Grade</p><p className="font-semibold">{e.currentGrade ?? "Not set"}</p></div><Indicator label="Attendance" value={e.attendance} /><Indicator label="Confidence" value={e.confidenceScore} /><span className="text-xs text-muted">{tasks.filter((x) => x.status === "DONE").length}/{tasks.length} tasks, {sessions.filter((x) => x.status === "DONE").length}/{sessions.length} sessions</span><ArrowRight className="h-4 w-4" /></Link>; }) : <p className="text-sm text-muted">No courses are enrolled yet.</p>}</div></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-border p-5"><h2 className="text-lg font-semibold">Assessment history</h2><div className="mt-4 grid gap-3">{data.assessments.length ? data.assessments.slice(-10).reverse().map((item) => { const value = Math.round(Number(item.score) / Number(item.maxScore) * 1000) / 10; return <div key={item.id} className="rounded-md border border-border bg-surface p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{item.course.name} - {item.title}</p><p className="text-sm text-muted">{item.type}</p></div><span className="font-semibold">{value}%</span></div><div className="mt-3 h-2 bg-background"><div className="h-full bg-accent" style={{width: `${Math.min(value,100)}%`}} /></div></div>; }) : <p className="text-sm text-muted">No assessment history yet.</p>}</div></div>
      <div className="rounded-lg border border-border p-5"><h2 className="text-lg font-semibold">CWA history</h2><div className="mt-4 grid gap-3">{data.cwaSnapshots.length ? data.cwaSnapshots.slice(-10).reverse().map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-4"><span className="text-sm text-muted">{new Intl.DateTimeFormat("en-GH", {dateStyle:"medium"}).format(item.recordedAt)}</span><span className="text-xl font-semibold">{item.cwa.toString()}%</span></div>) : <p className="text-sm text-muted">CWA changes will appear after the next saved update.</p>}</div></div>
    </section>
    <section className="mt-6 rounded-lg border border-border p-5"><div className="flex items-center gap-3"><TriangleAlert className="h-5 w-5 text-accent" /><div><h2 className="text-lg font-semibold">Weak areas</h2><p className="text-sm text-muted">Topics needing additional attention.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.weakAreas.length ? data.weakAreas.map((a) => <article key={a.id} className="rounded-md border border-border bg-surface p-4"><div className="flex justify-between gap-4"><div><p className="text-xs font-semibold text-muted">{a.course.name}</p><h3 className="mt-2 font-semibold">{a.topic}</h3></div><span className="text-sm font-semibold">{pct(a.weaknessScore)}</span></div>{a.recommendation ? <p className="mt-3 text-sm text-muted">{a.recommendation}</p> : null}</article>) : <p className="text-sm text-muted">No weak areas recorded yet.</p>}</div></section>
  </AppShell>;
}
