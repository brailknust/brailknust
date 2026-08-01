import { BookOpen, LogOut } from "lucide-react";
import Link from "next/link";

import { NavDrawer } from "@/components/nav-drawer";
import { NotificationPoller } from "@/components/notification-poller";
import { signOut } from "@/features/auth/actions";
import { requireAppUser } from "@/features/auth/queries";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
};

export async function AppShell({ children, title, eyebrow }: AppShellProps) {
  const { appUser } = await requireAppUser();
  const topNavItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Academics", href: "/academics" },
    { label: "Planner", href: "/planner" },
    { label: "AI Chat", href: "/ai-chat" },
    { label: "Practice", href: "/practice" },
    { label: "Peers", href: "/peers" },
  ];

  const drawerNavItems = [
    ...(appUser.role === "ADMIN"
      ? [
          { label: "Admin content", href: "/admin/content" },
          { label: "Programme catalog", href: "/admin/catalog" },
        ]
      : []),
    { label: "Notifications", href: "/notifications" },
    { label: "Tasks", href: "/tasks" },
    { label: "Performance", href: "/performance" },
    { label: "Goals", href: "/goals" },
    { label: "Profile", href: "/profile" },
    { label: "Support", href: "/support" },
    { label: "Feedback", href: "/feedback" },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-4">
            <NavDrawer items={drawerNavItems} />

            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-foreground text-background">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">BRAIL KNUST</p>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  {eyebrow ?? "Student workspace"}
                </p>
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-3 lg:flex">
            {topNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-6 pb-5 sm:px-8 lg:hidden">
          {topNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            {eyebrow ?? "Phase 1"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">{title}</h1>
        </div>
        {children}
      </section>
      <NotificationPoller />
    </main>
  );
}
