"use client";

import Link from "next/link";
import { Bell, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

import { formatElapsed } from "@/lib/utils";

type Notice = { id: string; title: string; message: string; openUrl: string; actionLabel: string };
type ActiveStudySession = { id: string; startedAt: string; title: string } | null;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveStudySession>(null);
  const [pulse, setPulse] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let active = true;
    let seenIds = new Set<string>();
    async function refresh() {
      const response = await fetch('/api/notifications/poll', { cache: 'no-store' });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as { notifications?: Notice[]; activeStudySession?: ActiveStudySession };
      if (!active) return;
      const next = payload.notifications ?? [];
      setPulse(next.some((item) => !seenIds.has(item.id)));
      seenIds = new Set(next.map((item) => item.id));
      setItems(next);
      setActiveSession(payload.activeStudySession ?? null);
    }
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  // Ticks the running study-session clock shown in the dropdown, the same
  // way the study-session panel on /notifications does.
  useEffect(() => {
    if (!activeSession?.startedAt) return;
    const startedAt = activeSession.startedAt;
    function tick() {
      setElapsedMs(Date.now() - new Date(startedAt).getTime());
    }
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeSession?.startedAt]);

  async function update(id: string, intent: 'read' | 'dismiss') {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent }) });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const badgeCount = items.length + (activeSession ? 1 : 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setPulse(false); }}
        aria-label="Notifications"
        className={`relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-muted hover:border-accent hover:text-accent ${pulse || activeSession ? 'animate-pulse' : ''}`}
      >
        <Bell className="h-4 w-4" />
        {badgeCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1 text-[10px] font-bold leading-5 text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-border bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Notifications</p>
            <Link href="/notifications" className="text-xs font-semibold text-accent">View all</Link>
          </div>
          {activeSession ? (
            <Link
              href="/notifications#study-session"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-[var(--accent-strong)] p-3 text-white"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{activeSession.title}</span>
                <span className="block text-xs text-white/70">Study session running</span>
              </span>
              <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">{formatElapsed(elapsedMs)}</span>
            </Link>
          ) : null}
          {items.length ? (
            <div className="mt-2 grid gap-2">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl bg-surface p-3">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">{item.message}</p>
                  <div className="mt-2 flex gap-2">
                    <Link href={item.openUrl} onClick={() => void update(item.id, 'read')} className="text-xs font-semibold text-accent">Open</Link>
                    <button onClick={() => void update(item.id, 'read')} className="text-xs text-muted"><Check className="inline h-3.5 w-3.5" /> Read</button>
                    <button onClick={() => void update(item.id, 'dismiss')} className="ml-auto text-muted"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : !activeSession ? (
            <p className="p-3 text-sm text-muted">You&apos;re all caught up.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
