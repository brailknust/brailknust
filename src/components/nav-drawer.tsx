"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PrefetchLink } from "@/components/prefetch-link";

type NavDrawerProps = {
  items: {
    label: string;
    href: string;
    badge?: number;
  }[];
};

export function NavDrawer({ items }: NavDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const html = document.documentElement;
    const previousOverflow = html.style.overflow;

    html.classList.add("sidebar-open");
    html.style.overflow = "hidden";

    return () => {
      html.classList.remove("sidebar-open");
      html.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-muted shadow-sm hover:border-accent hover:text-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 cursor-default bg-[#07160d]/35 backdrop-blur-[2px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="fixed inset-y-0 left-0 z-[60] w-[min(19rem,88vw)] overflow-y-auto border-r border-emerald-950/20 bg-[var(--accent-strong)] p-5 text-white shadow-[24px_0_60px_rgba(2,34,16,0.28)]"
          >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                More Pages
              </p>
              <p className="mt-1 text-xs text-emerald-100/60">Workspace navigation</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="grid gap-2">
            {items.map((item) => (
              <PrefetchLink
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-emerald-50/85 hover:bg-white hover:text-[var(--accent-strong)]"
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </PrefetchLink>
            ))}
          </nav>
          </aside>
        </>
      ) : null}
    </div>
  );
}
