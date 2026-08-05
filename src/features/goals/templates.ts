import type { GoalCategory, GoalMetric, GoalTargetUnit, GoalTrackingSource, GoalType } from "@prisma/client";

export type GoalTemplate = { type: GoalType; label: string; metric: GoalMetric; category: GoalCategory; unit: GoalTargetUnit; source: GoalTrackingSource; requiresCourse: boolean; defaultPeriod: "SEMESTER" | "WEEKLY"; description: string };

export const goalTemplates: GoalTemplate[] = [
  { type: "ACADEMIC_CWA", label: "Academic CWA", metric: "CWA", category: "ACADEMIC", unit: "PERCENT", source: "ACADEMIC_RECORDS", requiresCourse: false, defaultPeriod: "SEMESTER", description: "BRAIL uses your current semester CWA." },
  { type: "COURSE_STUDY_TIME", label: "Course study time", metric: "STUDY_MINUTES", category: "STUDY_TIME", unit: "MINUTES", source: "PLANNER_SESSIONS", requiresCourse: true, defaultPeriod: "WEEKLY", description: "BRAIL sums completed planner sessions for the selected course." },
  { type: "COURSE_MASTERY", label: "Course mastery", metric: "COURSE_MASTERY", category: "COURSE_MASTERY", unit: "PERCENT", source: "QUIZZES_AND_ASSESSMENTS", requiresCourse: true, defaultPeriod: "SEMESTER", description: "BRAIL estimates mastery from diagnostics, practice, topic mastery, and assessments." },
  { type: "PRACTICE_QUESTIONS", label: "Practice questions", metric: "QUESTIONS_COMPLETED", category: "COURSE_MASTERY", unit: "QUESTIONS", source: "PRACTICE_ATTEMPTS", requiresCourse: true, defaultPeriod: "WEEKLY", description: "BRAIL counts completed diagnostic practice questions." },
  { type: "MANUAL_CHECKLIST", label: "Legacy manual goal", metric: "MANUAL", category: "PERSONAL", unit: "MANUAL", source: "MANUAL", requiresCourse: false, defaultPeriod: "SEMESTER", description: "Legacy manual goals are preserved but cannot be created in this version." },
];

export function goalTemplate(type: GoalType) { return goalTemplates.find((template) => template.type === type)!; }
