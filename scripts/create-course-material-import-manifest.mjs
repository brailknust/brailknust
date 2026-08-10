import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const reportIndex = args.indexOf("--report");
const outputIndex = args.indexOf("--output");
const configIndex = args.indexOf("--config");
if (reportIndex < 0 || !args[reportIndex + 1]) throw new Error("Pass --report with the dry-run JSON path.");
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Pass --output with the final manifest path.");
if (configIndex < 0 || !args[configIndex + 1]) throw new Error("Pass --config with the term's course-material-config JSON path.");

const report = JSON.parse(await readFile(path.resolve(args[reportIndex + 1]), "utf8"));
const output = path.resolve(args[outputIndex + 1]);
const config = JSON.parse(await readFile(path.resolve(args[configIndex + 1]), "utf8"));

// JSON has no Map, so per-file overrides/skips are arrays of { courseCode, fileName, ... } in the config.
const topicOverrides = new Map(
  (config.topicOverrides ?? []).map((entry) => [`${entry.courseCode}|${entry.fileName}`, entry.topics]),
);
const skipRules = new Map(
  (config.skipRules ?? []).map((entry) => [`${entry.courseCode}|${entry.fileName}`, entry.reason]),
);

const files = report.courses.flatMap((course) => course.files.map((file) => {
  const key = `${course.code}|${file.name}`;
  let status = file.status === "READY" ? "APPROVED" : "SKIPPED";
  let reason = file.warning ?? null;
  let topics = topicOverrides.get(key) ?? file.proposedTopics ?? [];

  if (skipRules.has(key)) {
    status = "SKIPPED";
    reason = skipRules.get(key);
    topics = [];
  }

  return {
    sourceRelativePath: `${course.sourceFolder}\\${file.name}`,
    courseCode: course.code,
    courseName: course.name,
    title: path.parse(file.name).name,
    materialType: file.materialType ?? null,
    topics,
    sizeMB: file.sizeMB,
    sha256: file.sha256,
    status,
    reason,
  };
}));

const manifest = {
  version: 1,
  createdAt: new Date().toISOString(),
  sourceRoot: report.source,
  termSlug: config.termSlug,
  mode: "APPROVED_PLAN_NO_UPLOAD",
  rules: {
    maximumFileSizeMB: 50,
    skipLegacyPowerPoint: true,
    allowGeneralResourcesTopic: true,
    allowMultipleTopicsPerMaterial: true,
    duplicateIdentity: "sha256",
  },
  summary: {
    approved: files.filter((file) => file.status === "APPROVED").length,
    skipped: files.filter((file) => file.status === "SKIPPED").length,
    approvedSizeMB: Math.round(files.filter((file) => file.status === "APPROVED").reduce((sum, file) => sum + file.sizeMB, 0) * 100) / 100,
  },
  files,
};

await writeFile(output, JSON.stringify(manifest, null, 2), "utf8");
console.log(JSON.stringify({ output, summary: manifest.summary }, null, 2));
