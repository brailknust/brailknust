import { calculateAssessmentAverage } from "@/features/academics/calculations";
import { calculateGoalProgress } from "@/features/goals/progress";

export type CalculatedGoal = ReturnType<typeof calculateGoalProgress> & { evidence: string };
function result(value: number, target: number, evidence: string): CalculatedGoal { return { ...calculateGoalProgress(value, target), evidence }; }
export function calculateCwaGoal(cwa: number, target: number) { return result(cwa, target, `Current semester CWA: ${cwa}%.`); }
export function calculateStudyTimeGoal(minutes: number, target: number, courseCode?: string) { return result(minutes, target, `${minutes} of ${target} study minutes completed${courseCode ? ` for ${courseCode}` : ""}.`); }
export function calculateMasteryGoal(diagnosticScores: number[], assessments: { score: number; maxScore: number; weight?: number | null }[], target: number) { const values = [...diagnosticScores, ...(assessments.length ? [calculateAssessmentAverage(assessments)] : [])].filter((value) => Number.isFinite(value)); const current = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0; return result(current, target, values.length ? `Mastery estimate from ${diagnosticScores.length} quiz signals and ${assessments.length} assessments.` : "Not enough data yet. Complete a diagnostic quiz or add an assessment."); }
export function calculatePracticeQuestionGoal(completed: number, target: number) { return result(completed, target, `${completed} practice questions completed.`); }
export function calculateManualGoal(current: number, target: number) { return result(current, target, "Updated manually by you."); }
