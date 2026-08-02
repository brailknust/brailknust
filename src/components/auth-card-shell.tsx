type AuthCardShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export function AuthCardShell({ children, eyebrow, title, description }: AuthCardShellProps) {
  return (
    <main className="grid min-h-screen bg-white text-foreground lg:grid-cols-[minmax(25rem,0.9fr)_minmax(30rem,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[var(--accent-strong)] p-12 text-white lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[var(--accent-strong)]"><BookOpen className="h-5 w-5" /></span>
          <span className="font-semibold">BRAIL KNUST</span>
        </Link>
        <div className="my-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">Your semester, in focus</p>
          <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">Plan with clarity. Study with direction.</h2>
          <div className="mt-10 grid gap-4 text-sm text-emerald-50/80">
            {["Keep courses, tasks, and deadlines connected", "Build realistic study plans around your timetable", "Understand progress before assessments arrive"].map((item) => (
              <p key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" />{item}</p>
            ))}
          </div>
        </div>
        <p className="text-xs text-emerald-100/55">Built around the KNUST academic experience.</p>
      </section>

      <section className="grid place-items-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-[0_24px_70px_rgba(4,92,46,0.08)] sm:p-8">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><BookOpen className="h-5 w-5" /></span>
            <span className="font-semibold">BRAIL KNUST</span>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
import { BookOpen, CheckCircle2 } from "lucide-react";
import Link from "next/link";
