"use client";

import { Fragment } from "react";

import { toggleUnavailableTime } from "@/features/planner/actions";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const slots = Array.from({ length: 12 }, (_, index) => {
  const startHour = index * 2;
  const endHour = startHour + 2;
  return {
    label: new Intl.DateTimeFormat("en-GH", {
      hour: "numeric",
      hour12: true,
      timeZone: "UTC",
    }).format(new Date(Date.UTC(1970, 0, 1, startHour))),
    startTime: `${startHour.toString().padStart(2, "0")}:00`,
    endTime: `${endHour.toString().padStart(2, "0")}:00`,
  };
});

export type UnavailableBlock = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseName: string | null;
};

function overlaps(start: string, end: string, block: UnavailableBlock) {
  return start < block.endTime && end > block.startTime;
}

export function UnavailableTimesGrid({ blocks }: { blocks: UnavailableBlock[] }) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-lg font-semibold">Weekly unavailable times</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Click a free block to mark it busy. Click it again to make it available. Saved classes
        are shown separately and cannot be changed here.
      </p>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-surface p-2">
        <div className="grid min-w-[840px] grid-cols-[90px_repeat(7,minmax(0,1fr))] gap-px bg-border">
          <div className="bg-white px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Time
          </div>
          {weekDays.map((day) => (
            <div key={day} className="bg-white px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {day}
            </div>
          ))}

          {slots.map((slot) => (
            <Fragment key={slot.startTime}>
              <div className="bg-white px-3 py-3 text-sm font-medium">
                {slot.label}
              </div>
              {weekDays.map((day, dayOfWeek) => {
                const overlapping = blocks.filter(
                  (block) =>
                    block.dayOfWeek === dayOfWeek &&
                    overlaps(slot.startTime, slot.endTime, block),
                );
                const classBlock = overlapping.find((block) => block.courseName);
                const isUnavailable = overlapping.some(
                  (block) =>
                    !block.courseName &&
                    block.startTime === slot.startTime &&
                    block.endTime === slot.endTime,
                );
                const disabled = Boolean(classBlock) || (overlapping.length > 0 && !isUnavailable);

                return (
                  <form action={toggleUnavailableTime} key={`${day}-${slot.startTime}`}>
                    <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
                    <input type="hidden" name="startTime" value={slot.startTime} />
                    <input type="hidden" name="endTime" value={slot.endTime} />
                    <button
                      type="submit"
                      disabled={disabled}
                      aria-pressed={isUnavailable}
                      title={classBlock?.courseName ?? (isUnavailable ? "Make available" : "Mark unavailable")}
                      className={
                        "min-h-14 w-full px-2 py-3 text-left text-xs font-semibold transition " +
                        (classBlock
                          ? "cursor-not-allowed bg-[var(--accent-strong)]/15 text-foreground"
                          : isUnavailable
                            ? "bg-accent text-white hover:opacity-90"
                            : disabled
                              ? "cursor-not-allowed bg-border text-muted"
                              : "bg-white text-muted hover:bg-[var(--accent-strong)] hover:text-white")
                      }
                    >
                      {classBlock ? "Class" : isUnavailable ? "Busy" : disabled ? "Busy" : "Free"}
                    </button>
                  </form>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Blue blocks are personal unavailable times. Grey blocks come from saved classes or other timetable entries.
      </p>
    </section>
  );
}
