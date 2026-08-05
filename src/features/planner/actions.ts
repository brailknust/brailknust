"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveWritableSemester } from "@/features/academics/semester-state";
import { accraWeekBounds, parseAccraDate } from "@/features/academics/time";
import { requireAppUser } from "@/features/auth/queries";
import { syncGoalProgressSnapshots } from "@/features/goals/progress-sync";
import {
  createStudyPlanItemSchema,
  createStudyPlanSchema,
  deleteStudyPlanItemSchema,
  studyPlanItemStatusSchema,
  updateStudyPlanItemSchema,
} from "@/features/planner/schemas";
import { syncNotificationsForUser } from "@/features/notifications/service";
import { prisma } from "@/server/db";

function optionalDate(value?: string) {
  return parseAccraDate(value);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function scheduledStartForDay(dayOfWeek: number, startTime: string) {
  const source = new Date();
  const { start: weekStart } = accraWeekBounds(source);
  weekStart.setUTCDate(weekStart.getUTCDate() + dayOfWeek);

  const [hours, minutes] = startTime.split(":").map(Number);
  weekStart.setUTCHours(hours, minutes, 0, 0);
  if (weekStart <= source) {
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  }
  return weekStart;
}

function timeOfDay(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

export async function toggleUnavailableTime(formData: FormData) {
  const { appUser } = await requireAppUser();
  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before updating unavailable times.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    !/^\d{2}:\d{2}$/.test(endTime) ||
    endTime <= startTime
  ) {
    throw new Error("Select a valid unavailable time slot.");
  }

  const slot = {
    userId: appUser.id,
    semesterId: appUser.activeSemesterId,
    courseId: null,
    dayOfWeek,
    startTime: timeOfDay(startTime),
    endTime: timeOfDay(endTime),
  };
  const existing = await prisma.timetableBlock.findFirst({
    where: slot,
    select: { id: true },
  });

  if (existing) {
    await prisma.timetableBlock.delete({ where: { id: existing.id } });
  } else {
    await prisma.timetableBlock.create({
      data: { ...slot, isBusy: true },
    });
  }

  revalidatePath("/planner");
  revalidatePath("/dashboard");
}

export async function createStudyPlan(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before creating a study plan.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = createStudyPlanSchema.parse({
    title: formData.get("title"),
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  });

  await prisma.studyPlan.create({
    data: {
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
      title: parsed.title,
      status: "ACTIVE",
      generatedByAi: false,
      startDate: optionalDate(parsed.startDate),
      endDate: optionalDate(parsed.endDate),
    },
  });

  revalidatePath("/planner");
  revalidatePath("/dashboard");
}

export async function createStudyPlanItem(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before adding study sessions.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = createStudyPlanItemSchema.parse({
    studyPlanId: formData.get("studyPlanId"),
    courseId: formData.get("courseId") || undefined,
    title: formData.get("title"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  const plan = await prisma.studyPlan.findFirst({
    where: {
      id: parsed.studyPlanId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
  });

  if (!plan) {
    throw new Error("Study plan not found in the active semester.");
  }

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        courseId: parsed.courseId,
      },
    });

    if (!enrollment) {
      throw new Error("Select one of your active-semester courses.");
    }
  }

  await prisma.studyPlanItem.create({
    data: {
      studyPlanId: parsed.studyPlanId,
      courseId: parsed.courseId,
      title: parsed.title,
      scheduledStart: scheduledStartForDay(parsed.dayOfWeek, parsed.startTime),
      durationMinutes: timeToMinutes(parsed.endTime) - timeToMinutes(parsed.startTime),
    },
  });

  await syncNotificationsForUser(appUser.id, true);
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidatePath("/planner");
  revalidatePath("/performance");
  redirect(`/planner?planId=${parsed.studyPlanId}&day=${parsed.dayOfWeek}#study-timetable`);
}

export async function updateStudyPlanItem(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before editing study sessions.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = updateStudyPlanItemSchema.parse({
    id: formData.get("id"),
    studyPlanId: formData.get("studyPlanId"),
    courseId: formData.get("courseId") || undefined,
    title: formData.get("title"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  const plan = await prisma.studyPlan.findFirst({
    where: {
      id: parsed.studyPlanId,
      userId: appUser.id,
      semesterId: appUser.activeSemesterId,
    },
  });
  if (!plan) {
    throw new Error("Study plan not found in the active semester.");
  }

  if (parsed.courseId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
        courseId: parsed.courseId,
      },
    });
    if (!enrollment) {
      throw new Error("Select one of your active-semester courses.");
    }
  }

  const scheduledStart = scheduledStartForDay(parsed.dayOfWeek, parsed.startTime);
  const [result] = await prisma.$transaction([
    prisma.studyPlanItem.updateMany({
      where: {
        id: parsed.id,
        studyPlanId: parsed.studyPlanId,
        studyPlan: {
          userId: appUser.id,
          semesterId: appUser.activeSemesterId,
        },
      },
      data: {
        courseId: parsed.courseId ?? null,
        title: parsed.title,
        scheduledStart,
        durationMinutes: timeToMinutes(parsed.endTime) - timeToMinutes(parsed.startTime),
      },
    }),
    prisma.notification.deleteMany({
      where: {
        userId: appUser.id,
        sourceKey: { startsWith: `study-session-close:${parsed.id}:` },
      },
    }),
  ]);

  if (!result.count) {
    throw new Error("Study session not found in the active semester.");
  }

  await syncNotificationsForUser(appUser.id, true);
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
  revalidatePath("/notifications");
  redirect(`/planner?planId=${parsed.studyPlanId}&day=${parsed.dayOfWeek}#study-timetable`);
}
export async function deleteStudyPlanItem(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before deleting study sessions.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const parsed = deleteStudyPlanItemSchema.parse({
    id: formData.get("id"),
    studyPlanId: formData.get("studyPlanId"),
    dayOfWeek: formData.get("dayOfWeek"),
  });

  const [result] = await prisma.$transaction([
    prisma.studyPlanItem.deleteMany({
      where: {
        id: parsed.id,
        studyPlanId: parsed.studyPlanId,
        studyPlan: {
          userId: appUser.id,
          semesterId: appUser.activeSemesterId,
        },
      },
    }),
    prisma.notification.deleteMany({
      where: {
        userId: appUser.id,
        sourceKey: { startsWith: `study-session-close:${parsed.id}:` },
      },
    }),
  ]);

  if (!result.count) {
    throw new Error("Study session not found in the active semester.");
  }

  await syncNotificationsForUser(appUser.id, true);
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
  revalidatePath("/notifications");
  redirect(`/planner?planId=${parsed.studyPlanId}&day=${parsed.dayOfWeek}#study-timetable`);
}
export async function updateStudyPlanItemStatus(formData: FormData) {
  const { appUser } = await requireAppUser();

  if (!appUser.activeSemesterId) {
    throw new Error("Set an active semester before updating study sessions.");
  }
  await requireActiveWritableSemester(appUser.id, appUser.activeSemesterId);

  const id = String(formData.get("id") ?? "");
  const status = studyPlanItemStatusSchema.parse(formData.get("status"));

  await prisma.studyPlanItem.updateMany({
    where: {
      id,
      studyPlan: {
        userId: appUser.id,
        semesterId: appUser.activeSemesterId,
      },
    },
    data: { status },
  });

  await syncNotificationsForUser(appUser.id, true);
  await syncGoalProgressSnapshots(appUser.id, appUser.activeSemesterId);
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  revalidatePath("/performance");
}
