"use client";

import { useEffect, useState } from "react";
import { Play, Square, Timer } from "lucide-react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { startStudyTimer, stopStudyTimer } from "@/features/tracking/actions";
import { formatElapsed } from "@/lib/utils";

type ActiveSession = {
  id: string;
  startedAt: Date | null;
  course: { name: string } | null;
  studyPlanItem: { title: string } | null;
} | null;

type UpcomingItem = {
  id: string;
  title: string;
  scheduledStart: Date | null;
  durationMinutes: number | null;
  course: { name: string } | null;
};

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GH", { timeStyle: "short" }).format(value);
}

export function StudySessionPanel({ active, upcoming }: { active: ActiveSession; upcoming: UpcomingItem[] }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active?.startedAt) return;
    const startedAt = active.startedAt;
    function tick() {
      setElapsedMs(Date.now() - new Date(startedAt).getTime());
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [active?.startedAt]);

  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-3">
        <Timer className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Study session</h2>
      </div>

      {active ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/40 bg-surface p-4">
          <div>
            <p className="text-sm font-semibold">
              {active.studyPlanItem?.title.split("||")[0]?.trim() ?? active.course?.name ?? "Study session"}
            </p>
            {active.course?.name ? <p className="text-xs text-muted">{active.course.name}</p> : null}
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-accent">{formatElapsed(elapsedMs)}</p>
          </div>
          <form action={stopStudyTimer}>
            <input type="hidden" name="studySessionId" value={active.id} />
            <PendingSubmitButton pendingLabel="Stopping..." className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
              <Square className="h-4 w-4" /> Stop
            </PendingSubmitButton>
          </form>
        </div>
      ) : upcoming.length ? (
        <div className="mt-4 grid gap-2">
          {upcoming.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title.split("||")[0]?.trim()}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {item.course?.name ?? "General study"}
                  {item.scheduledStart ? ` · ${timeLabel(item.scheduledStart)}` : ""}
                  {item.durationMinutes ? ` · ${item.durationMinutes} min` : ""}
                </p>
              </div>
              <form action={startStudyTimer}>
                <input type="hidden" name="studyPlanItemId" value={item.id} />
                <PendingSubmitButton pendingLabel="Starting..." className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white">
                  <Play className="h-3.5 w-3.5" /> Start
                </PendingSubmitButton>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No study sessions scheduled for today. Add one from your planner.</p>
      )}
    </section>
  );
}
