"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavDrawerProps = {
  items: {
    label: string;
    href: string;
    badge?: number;
  }[];
};

export function NavDrawer({ items }: NavDrawerProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;

    if (open) {
      html.classList.add("sidebar-open");
    } else {
      html.classList.remove("sidebar-open");
    }

    return () => {
      html.classList.remove("sidebar-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (drawerRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label="Open navigation menu"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted shadow-sm transition hover:border-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : null}

      {open ? (
        <div
          ref={drawerRef}
          className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface p-5 shadow-xl"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                More Pages
              </p>
              <p className="mt-1 text-xs text-muted">Opened from hamburger</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted shadow-sm transition hover:border-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="grid gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground"
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
