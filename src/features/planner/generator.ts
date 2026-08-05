export const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type TimetableRow = {
  id: string;
  courseCode: string;
  courseName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue?: string;
  confidence?: number;
};

export type PlannerPreferences = {
  sessionLength: number;
  preferredStart: string;
  preferredEnd: string;
  intensity: "light" | "balanced" | "intense";
};

export type BusyBlock = {
  start: number;
  end: number;
};

export type CourseSource = {
  id?: string;
  courseCode: string;
  courseName: string;
  creditHours: number;
};

export type GeneratedSession = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: string;
  task: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  reason: string;
};

export function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function toMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function overlaps(start: number, end: number, block: BusyBlock) {
  return start < block.end && end > block.start;
}

export function isValidTimetableRow(row: TimetableRow) {
  return (
    row.courseCode.trim().length > 0 &&
    row.courseName.trim().length > 0 &&
    weekDays.includes(row.dayOfWeek as (typeof weekDays)[number]) &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.startTime) &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.endTime) &&
    toMinutes(row.startTime) < toMinutes(row.endTime)
  );
}

export function hasTimetableConflicts(rows: TimetableRow[]) {
  return rows.some((row, index) => rows.slice(index + 1).some((other) =>
    row.dayOfWeek === other.dayOfWeek
    && overlaps(toMinutes(row.startTime), toMinutes(row.endTime), {
      start: toMinutes(other.startTime),
      end: toMinutes(other.endTime),
    }),
  ));
}

export function sessionsForCourse(
  creditHours: number,
  intensity: PlannerPreferences["intensity"],
) {
  const normalizedCredits = Math.min(4, Math.max(1, Math.round(creditHours)));
  const sessionsByCredits = {
    1: { light: 1, balanced: 1, intense: 1 },
    2: { light: 1, balanced: 1, intense: 2 },
    3: { light: 2, balanced: 2, intense: 2 },
    4: { light: 2, balanced: 3, intense: 3 },
  } as const;

  return sessionsByCredits[normalizedCredits as keyof typeof sessionsByCredits][intensity];
}

type GenerateStudySessionsInput = {
  rows: TimetableRow[];
  courses: CourseSource[];
  busyBlocks: Map<string, BusyBlock[]>;
  preferences: PlannerPreferences;
  idFactory?: () => string;
};

export function generateStudySessions({
  rows,
  courses,
  busyBlocks,
  preferences,
  idFactory = () => crypto.randomUUID(),
}: GenerateStudySessionsInput) {
  const planned: GeneratedSession[] = [];
  const sessionLength = preferences.sessionLength;
  const startWindow = toMinutes(preferences.preferredStart);
  const endWindow = toMinutes(preferences.preferredEnd);

  function plannedBlocksForDay(day: string) {
    return planned
      .filter((session) => session.dayOfWeek === day)
      .map((session) => ({
        start: toMinutes(session.startTime),
        end: toMinutes(session.endTime),
      }));
  }

  function dayLoad(day: string) {
    return planned.filter((session) => session.dayOfWeek === day).length;
  }

  function orderedDaysFor(targetIndex: number) {
    return [...weekDays]
      .map((day, index) => ({
        day,
        distance: (index - targetIndex + weekDays.length) % weekDays.length,
        load: dayLoad(day),
      }))
      .sort((a, b) => a.load - b.load || a.distance - b.distance)
      .map((item) => item.day);
  }

  const courseTargets = courses.map((course) => ({
    course,
    targetCount: sessionsForCourse(course.creditHours, preferences.intensity),
  }));
  const maximumTargetCount = Math.max(0, ...courseTargets.map((item) => item.targetCount));

  // Schedule in coverage rounds so each course gets one session before
  // higher-credit courses receive additional weighted sessions.
  for (let count = 0; count < maximumTargetCount; count += 1) {
    courseTargets.forEach(({ course, targetCount }, courseIndex) => {
      if (count >= targetCount) return;

      let placed = false;
      const targetDayIndex =
        (courseIndex + count * Math.ceil(courses.length / targetCount)) % weekDays.length;

      for (const day of orderedDaysFor(targetDayIndex)) {
        if (placed) break;

        const dayBlocks = [...(busyBlocks.get(day) ?? []), ...plannedBlocksForDay(day)];
        const timeOffset = (courseIndex % 3) * 30;

        for (
          let start = startWindow + timeOffset;
          start + sessionLength <= endWindow;
          start += 30
        ) {
          const end = start + sessionLength;
          if (dayBlocks.some((block) => overlaps(start, end, block))) continue;

          planned.push({
            id: idFactory(),
            dayOfWeek: day,
            startTime: toTime(start),
            endTime: toTime(end),
            subject: `${course.courseCode} - ${course.courseName}`,
            task:
              count === 0
                ? "Review lecture notes"
                : count === 1
                  ? "Practice problem set"
                  : "Recall and summary session",
            durationMinutes: sessionLength,
            priority: count === 0 ? "high" : count === 1 ? "medium" : "low",
            reason: rows.length
              ? `Prioritized as a ${course.creditHours}-credit course and scheduled in a free ${sessionLength}-minute block outside your saved classes and unavailable times.`
              : `Prioritized as a ${course.creditHours}-credit course, scheduled around your saved unavailable times, and spread across your preferred study week.`,
          });
          placed = true;
          break;
        }
      }
    });
  }

  return planned.sort(
    (a, b) =>
      weekDays.indexOf(a.dayOfWeek as (typeof weekDays)[number]) -
        weekDays.indexOf(b.dayOfWeek as (typeof weekDays)[number]) ||
      toMinutes(a.startTime) - toMinutes(b.startTime),
  );
}
