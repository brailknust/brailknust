"use client";

import { Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteStudyPlanItem, updateStudyPlanItem } from "@/features/planner/actions";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type SavedStudySession = {
  id: string;
  courseId: string | null;
  dayIndex: number;
  startTime: string;
  endTime: string;
  title: string;
  courseLabel: string;
  durationLabel: string;
  reason: string;
};

type CourseOption = { id: string; code: string; name: string };

type SavedStudyTimetableProps = {
  studyPlanId: string;
  sessions: SavedStudySession[];
  courseOptions: CourseOption[];
  initialDayIndex?: number;
};

export function SavedStudyTimetable({ studyPlanId, sessions, courseOptions, initialDayIndex }: SavedStudyTimetableProps) {
  const firstSessionDay = initialDayIndex ?? sessions.find((session) => session.dayIndex >= 0)?.dayIndex ?? 0;
  const [selectedDayIndex, setSelectedDayIndex] = useState(firstSessionDay);

  const selectedSessions = useMemo(
    () => sessions.filter((session) => session.dayIndex === selectedDayIndex),
    [selectedDayIndex, sessions],
  );

  return (
    <div className="mt-5">
      <div className="flex gap-3 overflow-x-auto border-b border-border pb-5">
        {weekDays.map((day, index) => {
          const active = selectedDayIndex === index;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDayIndex(index)}
              className={"h-12 shrink-0 rounded-2xl px-5 text-sm font-semibold transition " + (active ? "bg-[var(--accent-strong)] text-white" : "bg-surface text-muted hover:bg-border hover:text-foreground")}
            >
              {day}
            </button>
          );
        })}
      </div>

      <section id="study-timetable" className="mt-6 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{weekDays[selectedDayIndex]}&apos;s Study Sessions</h3>
          <a href="#manual-study-session" className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
            <Plus className="h-4 w-4" /> Add Study Session
          </a>
        </div>

        <div className="mt-5 grid gap-4">
          {selectedSessions.length ? selectedSessions.map((session) => (
            <article key={session.id} className="rounded-xl border-l-4 border-accent bg-surface p-5">
              <div className="grid gap-4 md:grid-cols-[160px_1fr_auto]">
                <p className="text-sm font-medium text-muted">{session.startTime} - {session.endTime}</p>
                <div>
                  <h4 className="font-semibold">{session.courseLabel}</h4>
                  <p className="mt-2 text-sm text-muted">{session.title}</p>
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><Clock3 className="h-4 w-4" />{session.durationLabel}</p>
                  {session.reason ? <p className="mt-3 text-sm leading-6 text-muted">{session.reason}</p> : null}
                </div>
                <div className="flex items-start gap-2">

                  <form action={deleteStudyPlanItem}>
                    <input type="hidden" name="id" value={session.id} />
                    <input type="hidden" name="studyPlanId" value={studyPlanId} />
                    <input type="hidden" name="dayOfWeek" value={selectedDayIndex} />
                    <ConfirmSubmitButton message={`Delete the ${session.courseLabel} study session from ${weekDays[selectedDayIndex]}?`} className="grid h-9 w-9 place-items-center rounded-xl border border-red-300 text-red-600 transition hover:bg-red-50" aria-label={`Delete ${session.courseLabel} study session`} title="Delete study session">
                      <Trash2 className="h-4 w-4" />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>

              <details className="mt-4 border-t border-border pt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent"><Pencil className="h-4 w-4" /> Edit session</summary>
                <form action={updateStudyPlanItem} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={session.id} />
                  <input type="hidden" name="studyPlanId" value={studyPlanId} />
                  <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                    Description
                    <input name="title" required defaultValue={session.title} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                    Course
                    <select name="courseId" defaultValue={session.courseId ?? ""} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal">
                      <option value="">General study</option>
                      {courseOptions.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                    Day
                    <select name="dayOfWeek" required defaultValue={session.dayIndex} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal">
                      {weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">Start time<input name="startTime" type="time" required defaultValue={session.startTime} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" /></label>
                  <label className="grid gap-2 text-sm font-semibold">End time<input name="endTime" type="time" required defaultValue={session.endTime} className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal" /></label>
                  <button className="h-11 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white sm:col-span-2">Save changes</button>
                </form>
              </details>
            </article>
          )) : <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No study sessions planned for {weekDays[selectedDayIndex]}.</p>}
        </div>
      </section>
    </div>
  );
}
