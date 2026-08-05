import type { AcademicLevel, SemesterTerm } from "@prisma/client";

export type CurriculumImportRowInput = {
  rowNumber: number;
  courseCode: string | null;
  courseName: string | null;
  creditHours: number | null;
  level: AcademicLevel | null;
  term: SemesterTerm | null;
  error: string | null;
};

const expectedHeaders = ["coursecode", "coursename", "credithours", "level", "term"] as const;
const levelValues = new Set<AcademicLevel>(["LEVEL_100", "LEVEL_200", "LEVEL_300", "LEVEL_400", "LEVEL_500", "LEVEL_600"]);
const termAliases: Record<string, SemesterTerm> = {
  FIRST: "FIRST",
  "FIRST SEMESTER": "FIRST",
  SECOND: "SECOND",
  "SECOND SEMESTER": "SECOND",
};

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[ _-]/g, "");
}

function readCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return { values, unterminatedQuote: quoted };
}

export function parseCurriculumCsv(csv: string): CurriculumImportRowInput[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return [{ rowNumber: 1, courseCode: null, courseName: null, creditHours: null, level: null, term: null, error: "Add a header row and at least one course." }];
  }
  const header = readCsvLine(lines[0]);
  const headers = header.values.map(normalizeHeader);
  const missingHeaders = expectedHeaders.filter((expected) => !headers.includes(expected));
  if (header.unterminatedQuote || missingHeaders.length) {
    return [{ rowNumber: 1, courseCode: null, courseName: null, creditHours: null, level: null, term: null, error: header.unterminatedQuote ? "The header has an unfinished quoted value." : `Required headers: ${expectedHeaders.join(", ")}.` }];
  }
  const positions = Object.fromEntries(headers.map((value, index) => [value, index]));
  const seenCodes = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const parsed = readCsvLine(line);
    const courseCode = parsed.values[positions.coursecode]?.trim().toUpperCase() || null;
    const courseName = parsed.values[positions.coursename]?.trim() || null;
    const creditText = parsed.values[positions.credithours]?.trim() || "";
    const creditHours = /^\d+$/.test(creditText) ? Number(creditText) : null;
    const levelValue = parsed.values[positions.level]?.trim().toUpperCase() as AcademicLevel;
    const level = levelValues.has(levelValue) ? levelValue : null;
    const term = termAliases[parsed.values[positions.term]?.trim().toUpperCase()] ?? null;
    const errors = [
      parsed.unterminatedQuote ? "Unfinished quoted value" : null,
      !courseCode || !/^[A-Z]{2,12}\s?\d{2,4}[A-Z]?$/.test(courseCode) ? "valid course code required" : null,
      !courseName || courseName.length < 2 ? "course name required" : null,
      creditHours === null || creditHours < 1 || creditHours > 12 ? "credit hours must be 1-12" : null,
      !level ? "level must be LEVEL_100 through LEVEL_600" : null,
      !term ? "term must be FIRST or SECOND" : null,
      courseCode && seenCodes.has(`${levelValue}:${term}:${courseCode}`) ? "duplicate course in this term" : null,
    ].filter(Boolean);
    if (courseCode && level && term) seenCodes.add(`${level}:${term}:${courseCode}`);
    return { rowNumber, courseCode, courseName, creditHours, level, term, error: errors.length ? errors.join("; ") : null };
  });
}
