"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

const browserAlertsKey = "brail-browser-study-alerts";
const seenAlertsKey = "brail-seen-study-alerts";

type StudyAlert = { id: string; title: string; message: string; openUrl: string };

export function NotificationPoller() {
  const router = useRouter();
  const [alert, setAlert] = useState<StudyAlert | null>(null);

  useEffect(() => {
    let disposed = false;

    async function poll() {
      try {
        const response = await fetch("/api/notifications/poll", { cache: "no-store" });
        if (!response.ok || disposed) return;

        const data = (await response.json()) as { notifications?: StudyAlert[] };
        const seen = new Set<string>(JSON.parse(sessionStorage.getItem(seenAlertsKey) ?? "[]"));
        const nextAlert = data.notifications?.find((notification) => !seen.has(notification.id));
        if (!nextAlert) return;

        seen.add(nextAlert.id);
        sessionStorage.setItem(seenAlertsKey, JSON.stringify([...seen].slice(-50)));
        setAlert(nextAlert);
        router.refresh();

        if (localStorage.getItem(browserAlertsKey) === "enabled" && "Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(nextAlert.title, { body: nextAlert.message, tag: nextAlert.id });
          notification.onclick = () => {
            window.focus();
            window.location.href = nextAlert.openUrl;
          };
        }
      } catch {
        // Polling must not interrupt the current page when the network is unavailable.
      }
    }

    const initialTimer = window.setTimeout(poll, 15_000);
    const interval = window.setInterval(poll, 5 * 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  if (!alert) return null;

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[calc(100%-2.5rem)] max-w-sm rounded-lg border border-accent/40 bg-background p-4 shadow-xl" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-white"><Bell className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted">{alert.message}</p>
          <Link href={alert.openUrl} className="mt-3 inline-flex h-9 items-center rounded-md bg-foreground px-3 text-sm font-semibold text-background">Open session</Link>
        </div>
        <button type="button" onClick={() => setAlert(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground" aria-label="Dismiss reminder" title="Dismiss reminder"><X className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}
