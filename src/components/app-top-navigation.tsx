"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = { label: string; href: string };

export function AppTopNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-[var(--accent-soft)] text-accent"
                : "text-muted hover:bg-background hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
