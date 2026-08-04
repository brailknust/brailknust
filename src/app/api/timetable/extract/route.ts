import { NextResponse } from "next/server";

import { findCurriculumTemplate } from "@/data/curricula";
import { getAppUserByAuthId, getSupabaseUser } from "@/features/auth/queries";
import { hasValidMaterialFileType, materialFileExtension } from "@/features/materials/extract";
import { extractTextFromImage } from "@/features/planner/timetable-ocr";
import { parseTimetableText } from "@/features/planner/timetable-parser";
import { prisma } from "@/server/db";
import { checkRateLimit, rateLimitResponse } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxImageSize = 6 * 1024 * 1024;

function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function POST(request: Request) {
  const authUser = await getSupabaseUser();

  if (!authUser) {
    return NextResponse.json({ message: "Sign in before extracting a timetable." }, { status: 401 });
  }

  const appUser = await getAppUserByAuthId(authUser.id);

  if (!appUser) {
    return NextResponse.json({ message: "Complete onboarding before extracting a timetable." }, { status: 404 });
  }

  const rateLimit = await checkRateLimit({ subject: appUser.id, action: "timetable-ocr", limit: 10, windowSeconds: 3600 });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ message: "Upload a timetable image first." }, { status: 400 });
  }

  if (!image.type.startsWith("image/")) {
    return NextResponse.json({ message: "The uploaded file must be an image." }, { status: 400 });
  }

  const extension = materialFileExtension(image.name);
  if (!["png", "jpg", "jpeg", "webp"].includes(extension) || !(await hasValidMaterialFileType(image))) {
    return NextResponse.json(
      { message: "The image contents do not match a supported PNG, JPG, or WEBP file." },
      { status: 415 },
    );
  }

  if (image.size > maxImageSize) {
    return NextResponse.json(
      { message: "This image is too large for local OCR. Upload a screenshot under 6MB." },
      { status: 413 },
    );
  }

  try {
    const rawText = await extractTextFromImage(image);
    const parsedRows = parseTimetableText(rawText);
    const academicContext = appUser.activeSemesterId
      ? await prisma.semester.findFirst({
          where: { id: appUser.activeSemesterId, ownerId: appUser.id },
          include: {
            profiles: {
              where: { userId: appUser.id },
              select: { level: true },
              take: 1,
            },
            enrollments: {
              where: { userId: appUser.id },
              include: { course: true },
            },
          },
        })
      : null;
    const level = academicContext?.profiles[0]?.level ?? appUser.level;
    const curriculum =
      academicContext && appUser.college && appUser.programme && appUser.department && level
        ? findCurriculumTemplate({
            college: appUser.college,
            programme: appUser.programme,
            department: appUser.department,
            level,
            semester: academicContext.name,
          })
        : undefined;
    const coursesByCode = new Map<string, { code: string; name: string }>();

    for (const enrollment of academicContext?.enrollments ?? []) {
      coursesByCode.set(normalizeCourseCode(enrollment.course.code), {
        code: enrollment.course.code,
        name: enrollment.course.name,
      });
    }

    for (const course of curriculum?.courses ?? []) {
      coursesByCode.set(normalizeCourseCode(course.code), {
        code: course.code,
        name: course.name,
      });
    }

    let matchedCourseNames = 0;
    const rows = parsedRows.map((row) => {
      const course = coursesByCode.get(normalizeCourseCode(row.courseCode));

      if (!course) return row;
      matchedCourseNames += 1;

      return {
        ...row,
        courseCode: row.courseCode,
        courseName: course.name,
      };
    });

    return NextResponse.json({
      rows,
      rawText,
      source: {
        fileName: image.name,
        fileSize: image.size,
        mode: "tesseract-ocr",
        matchedCourseNames,
      },
      message:
        rows.length > 0
          ? "OCR found timetable rows. Review and correct them before generating your study plan."
          : "OCR read the image, but no class rows were detected. Add rows manually or upload a clearer image.",
    });
  } catch (error) {
    console.error("Timetable OCR failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { message: "Could not read this timetable image. Try a clearer image or enter the rows manually.", rows: [], rawText: "" },
      { status: 422 },
    );
  }
}
