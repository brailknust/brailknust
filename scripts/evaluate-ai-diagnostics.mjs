import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateGroundedAnswer, insufficientMaterialResponse, requiresCourseMaterial } from "../src/features/ai/grounding.ts";

const inputPath = path.resolve("evaluations/course-ai-diagnostic.json");
const outputPath = path.resolve("evaluation-reports/course-ai-diagnostic.json");
const evaluation = JSON.parse(await readFile(inputPath, "utf8"));

const cases = evaluation.cases.map((item) => {
  const groundingRequired = requiresCourseMaterial(item.prompt);
  const grounded = evaluateGroundedAnswer({ answer: item.groundedAnswer, availableReferences: item.references, requiresGrounding: groundingRequired });
  const insufficient = evaluateGroundedAnswer({
    answer: insufficientMaterialResponse({ code: item.courseCode, name: item.topic }),
    availableReferences: [],
    requiresGrounding: groundingRequired,
  });
  const diagnosticSelfContained = !/\b(?:S\d+|source|document|figure|diagram|shown above|shown below)\b/i.test(item.diagnosticPrompt);
  return {
    courseCode: item.courseCode,
    topic: item.topic,
    groundingRequired,
    groundedAnswerPassed: grounded.passed,
    insufficientMaterialPassed: insufficient.passed,
    diagnosticSelfContained,
    issues: [...grounded.issues, ...insufficient.issues, ...(diagnosticSelfContained ? [] : ["diagnostic_not_self_contained"])],
  };
});

const passed = cases.filter((item) => item.issues.length === 0).length;
const report = {
  evaluatedAt: new Date().toISOString(),
  version: evaluation.version,
  mode: "offline-policy-regression",
  note: "This verifies grounding and diagnostic-format controls without spending provider quota; live model quality still requires a controlled evaluation run.",
  courses: new Set(cases.map((item) => item.courseCode)).size,
  caseCount: cases.length,
  passed,
  passRate: cases.length ? passed / cases.length : 0,
  cases,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (passed !== cases.length) process.exitCode = 1;
