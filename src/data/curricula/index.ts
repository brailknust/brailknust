import { computerEngineeringCurricula } from "@/data/curricula/computer-engineering";
import type { CurriculumTemplate } from "@/data/curricula/types";

export const knustCurricula: CurriculumTemplate[] = [
  ...computerEngineeringCurricula,
];

export function findCurriculumTemplate(input: {
  college: string;
  programme: string;
  department: string;
  level: string;
  semester: string;
  version?: string;
}) {
  return knustCurricula.find(
    (template) =>
      template.college === input.college &&
      template.program === input.programme &&
      template.department === input.department &&
      (!input.version || template.version === input.version) &&
      template.level === input.level &&
      template.semester === input.semester,
  );
}

export function getCurriculumVersions(input: { college: string; programme: string; department?: string }) {
  return [...new Set(knustCurricula.filter((template) => template.college === input.college && template.program === input.programme && (!input.department || template.department === input.department)).map((template) => template.version))].sort().reverse();
}

export function findProgrammeCurriculum(input: { college: string; programme: string; department: string; version: string }) {
  return knustCurricula.find((template) => template.college === input.college && template.program === input.programme && template.department === input.department && template.version === input.version);
}

export type { CurriculumCourse, CurriculumTemplate } from "@/data/curricula/types";
