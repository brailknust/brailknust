"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

type DashboardNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

type PolledNotice = { id: string; title: string; message: string; createdAt: string };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

// Mirrors the bell's own poll cadence (see notification-bell.tsx) so a
// reminder that lands in the bell shows up here too without a page reload.
export function DashboardNotificationsPanel({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: DashboardNotice[];
  initialUnreadCount: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const response = await fetch("/api/notifications/poll", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const payload = (await response.json()) as { notifications?: PolledNotice[]; unreadCount?: number };
      if (cancelled) return;
      const incoming = payload.notifications ?? [];
      setUnreadCount(payload.unreadCount ?? 0);
      setItems((current) => {
        const merged = [
          ...incoming.map((notice) => ({ ...notice, isRead: false })),
          ...current.filter((item) => !incoming.some((notice) => notice.id === item.id)),
        ];
        return merged.slice(0, 4);
      });
    }
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-[0_10px_30px_rgba(4,92,46,0.03)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-muted">{unreadCount} unread reminders</p>
          </div>
        </div>
        <Link href="/notifications" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition hover:border-foreground hover:text-foreground">
          View all
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.length ? items.map((notification) => (
          <Link
            key={notification.id}
            href={`/notifications/${notification.id}/open`}
            className={"rounded-xl border p-4 transition hover:border-foreground " + (notification.isRead ? "border-border bg-surface" : "border-accent/50 bg-white")}
          >
            <p className="font-semibold">{notification.title}</p>
            <p className="mt-1 text-sm text-muted">{notification.message}</p>
            <p className="mt-3 text-xs text-muted">{formatDateTime(notification.createdAt)}</p>
          </Link>
        )) : <p className="text-sm text-muted">No notifications yet.</p>}
      </div>
    </section>
  );
}
