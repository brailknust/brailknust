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
}) {
  return knustCurricula.find(
    (template) =>
      template.college === input.college &&
      template.program === input.programme &&
      template.department === input.department &&
      template.level === input.level &&
      template.semester === input.semester,
  );
}

export type { CurriculumCourse, CurriculumTemplate } from "@/data/curricula/types";
