import { NextResponse } from "next/server";

import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const generatedPlanTitle = "Generated Study Timetable";

type TimetableRow = {
  id: string;
  courseCode: string;
  courseName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue?: string;
  confidence?: number;
};

type PlannerPreferences = {
  sessionLength: number;
  preferredStart: string;
  preferredEnd: string;
  intensity: "light" | "balanced" | "intense";
};

type GenerateBody = {
  rows?: TimetableRow[];
  preferences?: Partial<PlannerPreferences>;
};

type BusyBlock = {
  start: number;
  end: number;
};

type CourseSource = {
  id?: string;
  courseCode: string;
  courseName: string;
  creditHours: number;
};

type GeneratedSession = {
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

function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}


function toMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function overlaps(start: number, end: number, block: BusyBlock) {
  return start < block.end && end > block.start;
}

function isValidRow(row: TimetableRow) {
  return (
    row.courseCode.trim().length > 0 &&
    row.courseName.trim().length > 0 &&
    weekDays.includes(row.dayOfWeek as (typeof weekDays)[number]) &&
    toMinutes(row.startTime) < toMinutes(row.endTime)
  );
}

function sessionsForCourse(creditHours: number, intensity: PlannerPreferences["intensity"]) {
  const normalizedCredits = Math.min(4, Math.max(1, Math.round(creditHours)));
  const sessionsByCredits = {
    1: { light: 1, balanced: 1, intense: 1 },
    2: { light: 1, balanced: 1, intense: 2 },
    3: { light: 2, balanced: 2, intense: 2 },
    4: { light: 2, balanced: 3, intense: 3 },
  } as const;

  return sessionsByCredits[normalizedCredits as keyof typeof sessionsByCredits][intensity];
}

function getWeekBounds() {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = startDate.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  startDate.setUTCDate(startDate.getUTCDate() - daysSinceMonday);

  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);

  return { startDate, endDate };
}

function scheduledDateForSession(weekStart: Date, session: GeneratedSession) {
  const dayIndex = weekDays.indexOf(session.dayOfWeek as (typeof weekDays)[number]);
  const [hours = "0", minutes = "0"] = session.startTime.split(":");
  const date = new Date(weekStart);
  date.setUTCDate(weekStart.getUTCDate() + Math.max(dayIndex, 0));
  date.setUTCHours(Number(hours), Number(minutes), 0, 0);
  return date;
}

function dayFromDate(value: Date) {
  return weekDays[(value.getUTCDay() + 6) % 7];
}

function formatStoredTime(value: Date) {
  return `${value.getUTCHours().toString().padStart(2, "0")}:${value.getUTCMinutes().toString().padStart(2, "0")}`;
}

function timeOfDay(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

async function buildSavedSessions(userId: string, semesterId: string): Promise<GeneratedSession[]> {
  const plan = await prisma.studyPlan.findFirst({
    where: {
      userId,
      semesterId,
      title: generatedPlanTitle,
      generatedByAi: true,
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { scheduledStart: "asc" },
        include: {
          course: true,
        },
      },
    },
  });

  if (!plan) return [];

  return plan.items
    .filter((item) => item.scheduledStart)
    .map((item) => {
      const scheduledTime = item.scheduledStart as Date;
      const durationMinutes = item.durationMinutes ?? 60;
      const endTime = new Date(scheduledTime);
      endTime.setUTCMinutes(scheduledTime.getUTCMinutes() + durationMinutes);
      const [task = "Study session", reason = "Loaded from your saved study plan."] = item.title.split("||");
      const subject = item.course ? `${item.course.code} - ${item.course.name}` : "Study session";

      return {
        id: item.id,
        dayOfWeek: dayFromDate(scheduledTime),
        startTime: formatStoredTime(scheduledTime),
        endTime: formatStoredTime(endTime),
        subject,
        task: task.trim() || "Study session",
        durationMinutes,
        priority: "medium" as const,
        reason: item.aiReason ?? reason.trim() ?? "Loaded from your saved study plan.",
      };
    })
    .sort(
      (a, b) =>
        weekDays.indexOf(a.dayOfWeek as (typeof weekDays)[number]) -
          weekDays.indexOf(b.dayOfWeek as (typeof weekDays)[number]) ||
        toMinutes(a.startTime) - toMinutes(b.startTime),
    );
}

async function savePlanForUser(
  userId: string,
  activeSemesterId: string,
  rows: TimetableRow[],
  sourceCourses: CourseSource[],
  sessions: GeneratedSession[],
) {
  const { startDate, endDate } = getWeekBounds();
  const courseRecords = new Map<string, { id: string }>();
  const courses = Array.from(new Map(sourceCourses.map((course) => [course.courseCode, course])).values());

  for (const course of courses) {
    if (course.id) {
      courseRecords.set(course.courseCode, { id: course.id });
      continue;
    }

    const existingCourse = await prisma.course.findUnique({
      where: { code: course.courseCode },
      select: { id: true, approvalStatus: true, createdById: true },
    });
    if (
      existingCourse
      && existingCourse.approvalStatus !== "OFFICIAL"
      && existingCourse.createdById !== userId
    ) {
      throw new Error(`${course.courseCode} is awaiting administrator review for another student.`);
    }
    const record = existingCourse ?? await prisma.course.create({
      data: {
        code: course.courseCode,
        name: course.courseName || course.courseCode,
        approvalStatus: "PENDING",
        createdById: userId,
      },
      select: { id: true },
    });

    courseRecords.set(course.courseCode, record);

    await prisma.enrollment.upsert({
      where: {
        userId_courseId_semesterId: {
          userId,
          courseId: record.id,
          semesterId: activeSemesterId,
        },
      },
      create: {
        userId,
        courseId: record.id,
        semesterId: activeSemesterId,
      },
      update: {},
    });
  }

  const courseIds = Array.from(courseRecords.values()).map((course) => course.id);

  if (courseIds.length && rows.length) {
    await prisma.timetableBlock.deleteMany({
      where: {
        userId,
        semesterId: activeSemesterId,
        courseId: {
          in: courseIds,
        },
      },
    });

    await prisma.timetableBlock.createMany({
      data: rows
        .map((row) => {
          const course = courseRecords.get(row.courseCode);
          if (!course) return null;

          return {
            userId,
            semesterId: activeSemesterId,
            courseId: course.id,
            dayOfWeek: weekDays.indexOf(row.dayOfWeek as (typeof weekDays)[number]),
            startTime: timeOfDay(row.startTime),
            endTime: timeOfDay(row.endTime),
            venue: row.venue || undefined,
            isBusy: true,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    });
  }

  const existingPlan = await prisma.studyPlan.findFirst({
    where: {
      userId,
      semesterId: activeSemesterId,
      title: generatedPlanTitle,
      generatedByAi: true,
    },
    select: { id: true },
  });

  if (existingPlan) {
    await prisma.studyPlanItem.deleteMany({
      where: { studyPlanId: existingPlan.id },
    });

    await prisma.studyPlan.update({
      where: { id: existingPlan.id },
      data: {
        status: "ACTIVE",
        startDate,
        endDate,
      },
    });
  }

  const plan =
    existingPlan ??
    (await prisma.studyPlan.create({
      data: {
        userId,
        semesterId: activeSemesterId,
        title: generatedPlanTitle,
        status: "ACTIVE",
        generatedByAi: true,
        startDate,
        endDate,
      },
      select: { id: true },
    }));

  await prisma.studyPlanItem.createMany({
    data: sessions.map((session) => {
      const courseCode = session.subject.split(" - ")[0]?.trim();
      const course = courseRecords.get(courseCode);

      return {
        studyPlanId: plan.id,
        courseId: course?.id,
        title: `${session.task} || ${session.reason}`,
        scheduledStart: scheduledDateForSession(startDate, session),
        durationMinutes: session.durationMinutes,
        status: "TODO",
        aiReason: session.reason,
      };
    }),
  });

  return plan.id;
}

export async function GET() {
  const authUser = await getSupabaseUser();

  if (!authUser) {
    return NextResponse.json({ message: "Sign in before loading a study plan." }, { status: 401 });
  }

  const appUser = await getAppUserByAuthId(authUser.id);

  if (!appUser) {
    return NextResponse.json({ message: "Complete onboarding before loading a study plan." }, { status: 404 });
  }

  if (!appUser.activeSemesterId) {
    return NextResponse.json({ sessions: [], summary: null });
  }

  const sessions = await buildSavedSessions(appUser.id, appUser.activeSemesterId);
  const courseCodes = new Set(sessions.map((session) => session.subject.split(" - ")[0]).filter(Boolean));

  return NextResponse.json({
    sessions,
    summary: sessions.length
      ? {
          classCount: 0,
          courseCount: courseCodes.size,
          plannedHours: Math.round((sessions.reduce((sum, item) => sum + item.durationMinutes, 0) / 60) * 10) / 10,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const authUser = await getSupabaseUser();

  if (!authUser) {
    return NextResponse.json({ message: "Sign in before generating a study plan." }, { status: 401 });
  }

  const appUser = await getAppUserByAuthId(authUser.id);

  if (!appUser) {
    return NextResponse.json({ message: "Complete onboarding before generating a study plan." }, { status: 404 });
  }

  if (!appUser.activeSemesterId) {
    return NextResponse.json({ message: "Set an active semester before generating a study plan." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "study-plan-generate", limit: 20, windowSeconds: 3600 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const body = (await request.json().catch(() => null)) as GenerateBody | null;
  const rows = body?.rows?.filter(isValidRow) ?? [];

  const activeEnrollments = await prisma.enrollment.findMany({
    where: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
    include: { course: true },
    orderBy: {
      course: { code: "asc" },
    },
  });
  const savedBusyBlocks = await prisma.timetableBlock.findMany({
    where: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      isBusy: true,
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
    },
  });

  const rowCourses: CourseSource[] = Array.from(
    new Map(
      rows.map((row) => {
        const enrollment = activeEnrollments.find(
          (candidate) =>
            normalizeCourseCode(candidate.course.code) === normalizeCourseCode(row.courseCode),
        );

        return [
          row.courseCode,
          {
            id: enrollment?.courseId,
            courseCode: row.courseCode,
            courseName: row.courseName,
            creditHours: enrollment?.course.creditHours ?? 2,
          },
        ];
      }),
    ).values(),
  );
  const enrolledCourses: CourseSource[] = activeEnrollments.map((enrollment) => ({
    id: enrollment.courseId,
    courseCode: enrollment.course.code,
    courseName: enrollment.course.name,
    creditHours: enrollment.course.creditHours ?? 2,
  }));
  const courses = [...(rowCourses.length ? rowCourses : enrolledCourses)].sort(
    (a, b) => b.creditHours - a.creditHours || a.courseCode.localeCompare(b.courseCode),
  );

  if (courses.length === 0) {
    return NextResponse.json(
      { message: "Enroll in at least one active semester course before generating a study plan." },
      { status: 400 },
    );
  }

  const preferences: PlannerPreferences = {
    sessionLength: Math.min(Math.max(Number(body?.preferences?.sessionLength) || 60, 30), 120),
    preferredStart: body?.preferences?.preferredStart || "08:00",
    preferredEnd: body?.preferences?.preferredEnd || "21:00",
    intensity: body?.preferences?.intensity || "balanced",
  };

  const dayBusyBlocks = new Map<string, BusyBlock[]>();

  for (const day of weekDays) {
    dayBusyBlocks.set(day, []);
  }

  for (const block of savedBusyBlocks) {
    const day = weekDays[block.dayOfWeek];
    if (!day) continue;
    const blocks = dayBusyBlocks.get(day) ?? [];
    blocks.push({
      start: toMinutes(formatStoredTime(block.startTime)),
      end: toMinutes(formatStoredTime(block.endTime)),
    });
    dayBusyBlocks.set(day, blocks);
  }

  for (const row of rows) {
    const blocks = dayBusyBlocks.get(row.dayOfWeek) ?? [];
    blocks.push({
      start: Math.max(toMinutes(row.startTime) - 15, 0),
      end: Math.min(toMinutes(row.endTime) + 30, 24 * 60),
    });
    dayBusyBlocks.set(row.dayOfWeek, blocks);
  }

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
  const maximumTargetCount = Math.max(...courseTargets.map((item) => item.targetCount));

  // Schedule in coverage rounds so every course gets one session before
  // higher-credit courses receive their additional weighted sessions.
  for (let count = 0; count < maximumTargetCount; count += 1) {
    courseTargets.forEach(({ course, targetCount }, courseIndex) => {
      if (count >= targetCount) return;

      let placed = false;
      const targetDayIndex = (courseIndex + count * Math.ceil(courses.length / targetCount)) % weekDays.length;

      for (const day of orderedDaysFor(targetDayIndex)) {
        if (placed) break;

        const busyBlocks = [...(dayBusyBlocks.get(day) ?? []), ...plannedBlocksForDay(day)];
        const timeOffset = (courseIndex % 3) * 30;

        for (let start = startWindow + timeOffset; start + sessionLength <= endWindow; start += 30) {
          const end = start + sessionLength;
          const hasConflict = busyBlocks.some((block) => overlaps(start, end, block));

          if (!hasConflict) {
            planned.push({
              id: crypto.randomUUID(),
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
      }
    });
  }

  const sessions = planned.sort(
    (a, b) =>
      weekDays.indexOf(a.dayOfWeek as (typeof weekDays)[number]) -
        weekDays.indexOf(b.dayOfWeek as (typeof weekDays)[number]) ||
      toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  const planId = await savePlanForUser(appUser.id, appUser.activeSemesterId, rows, courses, sessions);

  return NextResponse.json({
    planId,
    sessions,
    summary: {
      classCount: rows.length,
      courseCount: courses.length,
      plannedHours: Math.round((planned.reduce((sum, session) => sum + session.durationMinutes, 0) / 60) * 10) / 10,
    },
  });
}





