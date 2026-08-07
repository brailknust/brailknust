import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseTimetableText } from "../src/features/planner/timetable-parser.ts";

const input = JSON.parse(await readFile(path.resolve("evaluations/timetable-ocr.json"), "utf8"));
const identity = (row) => `${row.courseCode}|${row.dayOfWeek}|${row.startTime}|${row.endTime}`;
const cases = input.cases.map((fixture) => {
  const actual = parseTimetableText(fixture.text);
  const expectedKeys = new Set(fixture.expected.map(identity));
  const actualKeys = new Set(actual.map(identity));
  const matched = [...expectedKeys].filter((key) => actualKeys.has(key)).length;
  return {
    id: fixture.id,
    expectedRows: expectedKeys.size,
    parsedRows: actualKeys.size,
    matchedRows: matched,
    recall: expectedKeys.size ? matched / expectedKeys.size : 1,
    exact: matched === expectedKeys.size && actualKeys.size === expectedKeys.size,
  };
});
const matchedRows = cases.reduce((sum, item) => sum + item.matchedRows, 0);
const expectedRows = cases.reduce((sum, item) => sum + item.expectedRows, 0);
const report = {
  evaluatedAt: new Date().toISOString(),
  version: input.version,
  mode: "representative-text-fixtures",
  note: "Text-fixture parsing is automated. Evaluation against real KNUST timetable images remains an external-input launch check.",
  caseCount: cases.length,
  expectedRows,
  matchedRows,
  recall: expectedRows ? matchedRows / expectedRows : 1,
  exactCases: cases.filter((item) => item.exact).length,
  cases,
};
const output = path.resolve("evaluation-reports/timetable-ocr.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.recall < 1 || report.exactCases !== report.caseCount) process.exitCode = 1;
