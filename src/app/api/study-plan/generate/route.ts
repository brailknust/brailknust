import { NextResponse } from "next/server";

import { accraWeekBounds } from "@/features/academics/time";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import {
  generateStudySessions,
  hasTimetableConflicts,
  isValidTimetableRow,
  normalizeCourseCode,
  toMinutes,
  weekDays,
  type BusyBlock,
  type CourseSource,
  type GeneratedSession,
  type PlannerPreferences,
  type TimetableRow,
  type UnscheduledCourse,
} from "@/features/planner/generator";
import { plannerPreferencesSchema } from "@/features/planner/schemas";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

const defaultPreferences: PlannerPreferences = {
  sessionLength: 60,
  preferredStart: "08:00",
  preferredEnd: "21:00",
  intensity: "balanced",
};

// A regular server database round trip during study-plan generation. Any
// single call comfortably fits inside this; it exists to fail fast instead
// of hanging the request indefinitely if the database is unreachable.
const dbCallTimeoutMs = 8_000;

// Generous headroom for the multi-statement save transaction below, which
// scales with enrolled-course count. The Prisma default (5s) is tight
// against a pooled remote connection once a semester has several courses
// with new, not-yet-enrolled codes to resolve.
const savePlanTransactionTimeoutMs = 20_000;

const generatedPlanTitle = "Generated Study Timetable";

type GenerateBody = {
  rows?: TimetableRow[];
  preferences?: Partial<PlannerPreferences>;
};


function getWeekBounds() {
  const { start: startDate } = accraWeekBounds();
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

async function loadPlannerContext(userId: string, semesterId: string) {
  const [activeEnrollments, savedBusyBlocks] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, semesterId },
      include: { course: true },
      orderBy: { course: { code: "asc" } },
    }),
    prisma.timetableBlock.findMany({
      where: { userId, semesterId, isBusy: true },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
  ]);
  return { activeEnrollments, savedBusyBlocks };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long. Try again in a moment.`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
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
  return prisma.$transaction(
    async (tx) => {
    const { startDate, endDate } = getWeekBounds();
    const courseRecords = new Map<string, { id: string }>();
    const warnings: string[] = [];
    const courses = Array.from(new Map(sourceCourses.map((course) => [course.courseCode, course])).values());

    for (const course of courses) {
      if (course.id) courseRecords.set(course.courseCode, { id: course.id });
    }

    // Courses without a known id come from OCR/manual rows that don't match
    // an existing enrollment. Resolve them in a single batched lookup rather
    // than one round trip per course, so generation for a full semester's
    // worth of courses stays comfortably inside the transaction timeout.
    const unresolvedCourses = courses.filter((course) => !course.id);

    if (unresolvedCourses.length) {
      const existingCourses = await tx.course.findMany({
        where: { code: { in: unresolvedCourses.map((course) => course.courseCode) } },
        select: { id: true, code: true, approvalStatus: true, createdById: true },
      });
      const existingByCode = new Map(existingCourses.map((course) => [course.code, course]));
      const toCreate: CourseSource[] = [];

      for (const course of unresolvedCourses) {
        const existingCourse = existingByCode.get(course.courseCode);
        if (!existingCourse) {
          toCreate.push(course);
          continue;
        }
        if (existingCourse.approvalStatus !== "OFFICIAL" && existingCourse.createdById !== userId) {
          // One course pending review under another student must not sink
          // the rest of an otherwise valid plan. The session for this
          // course still gets scheduled below, just without a course link.
          warnings.push(`${course.courseCode} is awaiting administrator review for another student, so it was scheduled without a linked course record.`);
          continue;
        }
        courseRecords.set(course.courseCode, { id: existingCourse.id });
      }

      if (toCreate.length) {
        const created = await tx.course.createManyAndReturn({
          data: toCreate.map((course) => ({
            code: course.courseCode,
            name: course.courseName || course.courseCode,
            approvalStatus: "PENDING" as const,
            createdById: userId,
          })),
          select: { id: true, code: true },
        });
        for (const record of created) courseRecords.set(record.code, { id: record.id });
      }

      // Only newly resolved courses need a fresh enrollment; courses that
      // already had a known id came from an existing enrollment.
      const newlyResolvedIds = unresolvedCourses
        .map((course) => courseRecords.get(course.courseCode)?.id)
        .filter((id): id is string => Boolean(id));
      if (newlyResolvedIds.length) {
        await tx.enrollment.createMany({
          data: newlyResolvedIds.map((courseId) => ({ userId, courseId, semesterId: activeSemesterId })),
          skipDuplicates: true,
        });
      }
    }

    const courseIds = Array.from(courseRecords.values()).map((course) => course.id);

    if (courseIds.length && rows.length) {
      await tx.timetableBlock.deleteMany({
      where: {
        userId,
        semesterId: activeSemesterId,
        courseId: {
          in: courseIds,
        },
      },
    });

      await tx.timetableBlock.createMany({
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

    const existingPlan = await tx.studyPlan.findFirst({
    where: {
      userId,
      semesterId: activeSemesterId,
      title: generatedPlanTitle,
      generatedByAi: true,
    },
    select: { id: true },
  });

    if (existingPlan) {
      await tx.studyPlanItem.deleteMany({
      where: { studyPlanId: existingPlan.id, aiReason: { not: null } },
    });

      await tx.studyPlan.update({
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
      (await tx.studyPlan.create({
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

    await tx.studyPlanItem.createMany({
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

    return { planId: plan.id, warnings };
  },
    { timeout: savePlanTransactionTimeoutMs },
  );
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

  const activeSemester = await prisma.semester.findFirst({
    where: { id: appUser.activeSemesterId, ownerId: appUser.id },
    select: { isArchived: true },
  });
  if (activeSemester?.isArchived) {
    return NextResponse.json(
      { message: "Archived semesters are read-only. Reopen this semester before generating a study plan." },
      { status: 409 },
    );
  }

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "study-plan-generate", limit: 20, windowSeconds: 3600 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const body = (await request.json().catch(() => null)) as GenerateBody | null;
  const submittedRows = body?.rows ?? [];
  if (submittedRows.some((row) => !isValidTimetableRow(row))) {
    return NextResponse.json({ message: "Correct the timetable rows before generating a study plan." }, { status: 400 });
  }
  if (hasTimetableConflicts(submittedRows)) {
    return NextResponse.json({ message: "Timetable rows overlap. Resolve the class conflict before generating a study plan." }, { status: 409 });
  }
  const rows = submittedRows;

  let plannerContext: Awaited<ReturnType<typeof loadPlannerContext>>;
  try {
    plannerContext = await withTimeout(
      loadPlannerContext(appUser.id, appUser.activeSemesterId),
      dbCallTimeoutMs,
      "Loading your courses and timetable",
    );
  } catch (error) {
    console.error("Could not load planner data for study-plan generation", error);
    return NextResponse.json(
      { message: "Could not reach the database to build your study plan. Try again in a moment." },
      { status: 503 },
    );
  }
  const { activeEnrollments, savedBusyBlocks } = plannerContext;

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
  // OCR is optional context. It must never remove enrolled courses that were
  // absent from, or incorrectly read from, an uploaded timetable.
  const courses = [...new Map<string, CourseSource>([
    ...enrolledCourses.map((course): [string, CourseSource] => [normalizeCourseCode(course.courseCode), course]),
    ...rowCourses.map((course): [string, CourseSource] => [normalizeCourseCode(course.courseCode), course]),
  ]).values()].sort(
    (a, b) => b.creditHours - a.creditHours || a.courseCode.localeCompare(b.courseCode),
  );

  if (courses.length === 0) {
    return NextResponse.json(
      { message: "Enroll in at least one active semester course before generating a study plan." },
      { status: 400 },
    );
  }

  // Merge over defaults so an omitted field falls back sensibly, but once
  // merged the whole window is validated: a malformed or out-of-range value
  // must be rejected here rather than silently reaching the generator, where
  // it would produce a plan with zero sessions and no explanation.
  const preferencesResult = plannerPreferencesSchema.safeParse({
    ...defaultPreferences,
    ...body?.preferences,
  });
  if (!preferencesResult.success) {
    return NextResponse.json(
      { message: preferencesResult.error.issues[0]?.message ?? "Check your study preferences and try again." },
      { status: 400 },
    );
  }
  const preferences: PlannerPreferences = preferencesResult.data;

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

  let sessions: GeneratedSession[];
  let unscheduled: UnscheduledCourse[];
  try {
    ({ sessions, unscheduled } = generateStudySessions({
      rows,
      courses,
      busyBlocks: dayBusyBlocks,
      preferences,
    }));
  } catch (error) {
    console.error("Study session generation failed", error);
    return NextResponse.json(
      { message: "Could not build study sessions from your timetable and preferences. Try adjusting your preferred hours." },
      { status: 422 },
    );
  }

  let planId: string;
  let warnings: string[];
  try {
    ({ planId, warnings } = await savePlanForUser(appUser.id, appUser.activeSemesterId, rows, courses, sessions));
  } catch (error) {
    console.error("Could not save generated study plan", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Could not save the generated study plan. Try again in a moment.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    planId,
    sessions,
    unscheduled,
    warnings,
    summary: {
      classCount: rows.length,
      courseCount: courses.length,
      plannedHours: Math.round((sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60) * 10) / 10,
    },
  });
}





