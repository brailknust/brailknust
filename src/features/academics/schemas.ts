import { z } from "zod";

export const academicLevelSchema = z.enum([
  "LEVEL_100",
  "LEVEL_200",
  "LEVEL_300",
  "LEVEL_400",
  "LEVEL_500",
  "LEVEL_600",
]);

export const createSemesterSchema = z.object({
  name: z.enum(["First Semester", "Second Semester"]),
  academicYear: z.string().trim().regex(/^\d{4}\/\d{4}$/),
  level: academicLevelSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.coerce.boolean().default(false),
}).refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "Semester end date must be on or after the start date.",
  path: ["endDate"],
});

export const createCourseSchema = z.object({
  code: z.string().trim().min(2).toUpperCase(),
  name: z.string().trim().min(2),
  creditHours: z.coerce.number().int().min(0).max(12).optional(),
  department: z.string().trim().optional(),
  level: academicLevelSchema.optional(),
  description: z.string().trim().optional(),
});

export const createEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
  semesterId: z.string().uuid(),
  lecturer: z.string().trim().optional(),
});

export const createTimetableBlockSchema = z.object({
  semesterId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  venue: z.string().trim().optional(),
}).refine((value) => value.endTime > value.startTime, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

export const semesterProfileSchema = z.object({
  semesterId: z.string().uuid(),
  level: academicLevelSchema.optional(),
  cwa: z.coerce.number().min(0).max(100).optional(),
});

export const activeSemesterSchema = z.object({
  semesterId: z.string().uuid(),
});

export const deleteSemesterSchema = z.object({
  semesterId: z.string().uuid(),
});

export const semesterArchiveSchema = z.object({
  semesterId: z.string().uuid(),
});

export const deleteEnrollmentSchema = z.object({
  enrollmentId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const enrollmentPerformanceSchema = z.object({
  enrollmentId: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  lecturer: z.string().trim().optional(),
  currentGrade: z.string().trim().max(5).optional(),
  attendance: z.coerce.number().min(0).max(100).optional(),
  confidenceScore: z.coerce.number().min(0).max(100).optional(),
});


export const weakAreaSchema = z.object({
  id: z.string().uuid().optional(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
  topic: z.string().trim().min(2).max(200),
  weaknessScore: z.coerce.number().min(0).max(100).optional(),
  detectedFrom: z.string().trim().max(500).optional(),
  recommendation: z.string().trim().max(1000).optional(),
});

export const deleteWeakAreaSchema = z.object({
  id: z.string().uuid(),
  semesterId: z.string().uuid(),
  courseId: z.string().uuid(),
});
