import type { AcademicLevel } from "@prisma/client";

export type CurriculumCourse = {
  code: string;
  name: string;
  creditHours: number;
};

export type CurriculumTemplate = {
  college: string;
  department: string;
  program: string;
  version: string;
  durationYears: number;
  termsPerYear: number;
  level: AcademicLevel;
  semester: "First Semester" | "Second Semester";
  source?: string;
  courses: CurriculumCourse[];
};
