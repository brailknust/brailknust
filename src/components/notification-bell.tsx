"use client";

import Link from "next/link";
import { Bell, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

type Notice = { id: string; title: string; message: string; openUrl: string; actionLabel: string };
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [pulse, setPulse] = useState(false);
  async function refresh() { const response = await fetch('/api/notifications/poll', { cache: 'no-store' }); if (!response.ok) return; const next = ((await response.json()) as { notifications?: Notice[] }).notifications ?? []; setPulse(next.some((item) => !items.some((seen) => seen.id === item.id))); setItems(next); }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 60_000); return () => window.clearInterval(timer); }, []);
  async function update(id: string, intent: 'read' | 'dismiss') { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent }) }); setItems((current) => current.filter((item) => item.id !== id)); }
  return <div className="relative"><button type="button" onClick={() => { setOpen((value) => !value); setPulse(false); }} aria-label="Notifications" className={`relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-muted hover:border-accent hover:text-accent ${pulse ? 'animate-pulse' : ''}`}><Bell className="h-4 w-4" />{items.length ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1 text-[10px] font-bold leading-5 text-white">{items.length > 9 ? '9+' : items.length}</span> : null}</button>{open ? <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-border bg-white p-3 shadow-xl"><div className="flex items-center justify-between px-2 py-1"><p className="text-sm font-semibold">Notifications</p><Link href="/notifications" className="text-xs font-semibold text-accent">View all</Link></div>{items.length ? <div className="mt-2 grid gap-2">{items.map((item) => <article key={item.id} className="rounded-xl bg-surface p-3"><p className="font-semibold text-sm">{item.title}</p><p className="mt-1 text-xs text-muted">{item.message}</p><div className="mt-2 flex gap-2"><Link href={item.openUrl} onClick={() => void update(item.id, 'read')} className="text-xs font-semibold text-accent">Open</Link><button onClick={() => void update(item.id, 'read')} className="text-xs text-muted"><Check className="inline h-3.5 w-3.5" /> Read</button><button onClick={() => void update(item.id, 'dismiss')} className="ml-auto text-muted"><X className="h-3.5 w-3.5" /></button></div></article>)}</div> : <p className="p-3 text-sm text-muted">You&apos;re all caught up.</p>}</div> : null}</div>;
}
