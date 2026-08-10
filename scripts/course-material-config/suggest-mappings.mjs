// Read-only helper: proposes a `courseMappings` array for a term's course-material-config JSON
// by cross-referencing a semester's source folder names against src/data/curricula/computer-engineering.ts.
// Writes nothing — paste/correct the printed JSON into the config file by hand.
//
// Usage:
//   node --experimental-strip-types scripts/course-material-config/suggest-mappings.mjs \
//     --source "C:\...\CoE\CoE 1\Second Semester" --level LEVEL_100 --semester "Second Semester"

import { readdir } from "node:fs/promises";
import path from "node:path";

import { computerEngineeringCurricula } from "../../src/data/curricula/computer-engineering.ts";

function parseArguments() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const levelIndex = args.indexOf("--level");
  const semesterIndex = args.indexOf("--semester");
  if (sourceIndex < 0 || !args[sourceIndex + 1]) throw new Error("Pass --source with the semester folder path.");
  if (levelIndex < 0 || !args[levelIndex + 1]) throw new Error("Pass --level (e.g. LEVEL_200).");
  if (semesterIndex < 0 || !args[semesterIndex + 1]) throw new Error('Pass --semester ("First Semester" or "Second Semester").');
  return {
    source: path.resolve(args[sourceIndex + 1]),
    level: args[levelIndex + 1],
    semester: args[semesterIndex + 1],
  };
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/^[\s.\d]+/, "") // strip leading ordinal digits/punctuation, e.g. "2 Communication Skills II" -> "communication skills ii"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchFolder(folderName, courses) {
  const normalizedFolder = normalize(folderName);
  const byCode = courses.find((course) => folderName.toLowerCase().includes(course.code.toLowerCase()));
  if (byCode) return { course: byCode, confidence: "code-match" };

  const candidates = courses.filter((course) => {
    const normalizedName = normalize(course.name);
    return normalizedFolder.includes(normalizedName) || normalizedName.includes(normalizedFolder);
  });
  if (candidates.length === 1) return { course: candidates[0], confidence: "name-match" };
  if (candidates.length > 1) return { course: null, confidence: "ambiguous", candidates };
  return { course: null, confidence: "unmatched" };
}

async function main() {
  const { source, level, semester } = parseArguments();
  const template = computerEngineeringCurricula.find((item) => item.level === level && item.semester === semester);
  if (!template) throw new Error(`No computerEngineeringCurricula entry for ${level} / ${semester}.`);

  const entries = await readdir(source, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const suggestions = [];
  const needsReview = [];
  for (const folder of folders) {
    const result = matchFolder(folder, template.courses);
    if (result.course) {
      suggestions.push({ folderIncludes: folder, code: result.course.code, name: result.course.name });
    } else {
      needsReview.push({ folder, confidence: result.confidence, candidates: result.candidates?.map((c) => c.code) });
    }
  }

  const matchedCodes = new Set(suggestions.map((item) => item.code));
  const missingCourses = template.courses.filter((course) => !matchedCodes.has(course.code));

  const yearNumber = Number(level.replace("LEVEL_", "")) / 100;
  const semesterSlug = semester.toLowerCase().replace(/\s+/g, "-");
  console.log(JSON.stringify({
    termSlug: `coe-${yearNumber}-${semesterSlug}`,
    suggestedCourseMappings: suggestions,
    needsManualReview: needsReview,
    coursesWithNoFolderMatch: missingCourses.map((course) => `${course.code} — ${course.name}`),
  }, null, 2));
}

await main();
