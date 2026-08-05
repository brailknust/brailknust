import { Bell, BookOpen, LogOut } from "lucide-react";

import { AppTopNavigation } from "@/components/app-top-navigation";
import { NavDrawer } from "@/components/nav-drawer";
import { NotificationPoller } from "@/components/notification-poller";
import { PrefetchLink } from "@/components/prefetch-link";
import { signOut } from "@/features/auth/actions";
import { requireAppUser } from "@/features/auth/queries";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  fullBleed?: boolean;
};

export async function AppShell({ children, eyebrow, fullBleed = false }: AppShellProps) {
  const { appUser } = await requireAppUser();
  const primaryItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Academics", href: "/academics" },
    { label: "Planner", href: "/planner" },
    { label: "AI Chat", href: "/ai-chat" },
    { label: "Practice", href: "/practice" },
    { label: "Peers", href: "/peers" },
  ];
  const secondaryItems = [
    ...(appUser.role === "ADMIN"
      ? [
          { label: "Admin content", href: "/admin/content" },
          { label: "Programme catalog", href: "/admin/catalog" },
          { label: "Admin access", href: "/admin/users" },
          { label: "Support and feedback", href: "/admin/feedback" },
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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex h-[4.875rem] w-full max-w-[90rem] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <NavDrawer items={secondaryItems} />
            <PrefetchLink href="/dashboard" className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.02em]">BRAIL KNUST</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {eyebrow ?? "Student workspace"}
                </span>
              </span>
            </PrefetchLink>
          </div>

          <AppTopNavigation items={primaryItems} />

          <div className="flex items-center gap-2">
            <PrefetchLink href="/notifications" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-muted hover:border-accent hover:text-accent">
              <Bell className="h-4 w-4" />
            </PrefetchLink>
            <form action={signOut}>
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-muted hover:border-accent hover:text-accent">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-[90rem] gap-2 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="Mobile primary navigation">
          {primaryItems.map((item) => (
            <PrefetchLink key={item.href} href={item.href} className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-muted hover:border-accent hover:text-accent">
              {item.label}
            </PrefetchLink>
          ))}
        </nav>
      </header>

      <section className={fullBleed
        ? "flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-4.875rem)]"
        : "mx-auto w-full max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"}
      >
        {children}
      </section>
      <NotificationPoller />
    </main>
  );
}
