import { z } from "zod";

import { knustAcademicHierarchy, knustProgrammes } from "@/data/knust-academic-hierarchy";

const knustCollegeNames = new Set(knustAcademicHierarchy.map((college) => college.name));
const knustProgrammePairs = new Set(
  knustProgrammes.map((programme) => `${programme.college}::${programme.name}`),
);

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name."),
    studentId: z.string().trim().min(3, "Enter your student ID."),
    college: z
      .string()
      .trim()
      .refine((value) => knustCollegeNames.has(value), "Select a valid KNUST college."),
    programme: z.string().trim().min(2, "Select your programme."),
    semesterName: z.enum(["First Semester", "Second Semester"], {
      message: "Select your current semester.",
    }),
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the format 2026/2027."),
    level: z.enum([
      "LEVEL_100",
      "LEVEL_200",
      "LEVEL_300",
      "LEVEL_400",
      "LEVEL_500",
      "LEVEL_600",
    ]),
    cwa: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine((value) => knustProgrammePairs.has(`${value.college}::${value.programme}`), {
    message: "Select a programme under the chosen KNUST college.",
    path: ["programme"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name."),
    studentId: z.string().trim().min(3, "Enter your student ID."),
    college: z
      .string()
      .trim()
      .refine((value) => knustCollegeNames.has(value), "Select a valid KNUST college."),
    programme: z.string().trim().min(2, "Select your programme."),
    level: z.enum([
      "LEVEL_100",
      "LEVEL_200",
      "LEVEL_300",
      "LEVEL_400",
      "LEVEL_500",
      "LEVEL_600",
    ]),
    activeSemesterId: z.string().uuid("Select a valid active semester.").optional(),
    cwa: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine((value) => knustProgrammePairs.has(`${value.college}::${value.programme}`), {
    message: "Select a programme under the chosen KNUST college.",
    path: ["programme"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
