import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ListChecks,
  UsersRound,
} from "lucide-react";

const featureCards = [
  {
    title: "Daily study plans",
    text: "Turn courses, deadlines, and timetable blocks into focused study sessions.",
    icon: CalendarDays,
  },
  {
    title: "Academic insight",
    text: "Track CWA, weak areas, task load, and course progress from real semester data.",
    icon: BarChart3,
  },
  {
    title: "Peer support",
    text: "Build study groups and resource-sharing spaces around enrolled courses.",
    icon: UsersRound,
  },
];

const workflow = [
  {
    label: "Set your context",
    title: "KNUST programme and semester",
    description: "Start with college, programme, level, active semester, and CWA.",
    icon: GraduationCap,
  },
  {
    label: "Organize the workload",
    title: "Courses, tasks, and timetable",
    description: "Keep assignments, quizzes, projects, and unavailable times in one workspace.",
    icon: ListChecks,
  },
  {
    label: "Plan with AI",
    title: "Study support that understands the semester",
    description: "Recommendations will use deadlines, course load, weak areas, and available time.",
    icon: Brain,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-[82vh] w-full max-w-7xl flex-col justify-between px-6 py-8 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-foreground text-background">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">BRAIL KNUST</p>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  AI academic planner
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 sm:inline-flex"
              >
                Sign up
              </Link>
            </div>
          </nav>

          <div className="grid gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
            <div>
              <p className="mb-5 inline-flex rounded-md border border-border bg-background px-3 py-1 text-sm font-semibold text-muted">
                AI-powered planning for every study session
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] tracking-normal sm:text-6xl">
                Plan smarter, study better, stay ahead of your semester.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                BRAIL helps KNUST students organize courses, track deadlines, plan study time,
                and prepare for AI guidance that understands their real academic workload.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Sign up
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:border-foreground"
                >
                  Login
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {featureCards.map((item) => (
                  <article key={item.title} className="rounded-lg border border-border bg-background p-5">
                    <item.icon className="h-5 w-5 text-accent" />
                    <h2 className="mt-7 text-lg font-semibold">{item.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-border bg-background p-5 shadow-sm">
              <div className="rounded-md bg-foreground p-4 text-background">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/65">
                      Study snapshot
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">Weekly focus</h2>
                  </div>
                  <span className="rounded-md border border-background/15 px-3 py-2 text-xs font-semibold">
                    AI
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-md border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                        Next session
                      </p>
                      <p className="mt-2 text-lg font-semibold">Revise active courses</p>
                    </div>
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-background">
                      <Clock3 className="h-5 w-5 text-accent" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                      Planner inputs
                    </p>
                    <ul className="mt-4 grid gap-3 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                        Courses
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                        Deadlines
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                        Timetable
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                      Support layer
                    </p>
                    <ul className="mt-4 grid gap-3 text-sm">
                      <li>AI chat</li>
                      <li>Weak areas</li>
                      <li>Study groups</li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">How it works</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Add your academic context once. BRAIL turns it into planning, reminders,
                    and eventually personalized study recommendations.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Academic flow
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal">
            Built around how students actually move through a semester.
          </h2>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.title} className="rounded-lg border border-border bg-surface p-6">
              <item.icon className="h-5 w-5 text-accent" />
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                {item.label}
              </p>
              <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
