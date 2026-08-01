import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const reportIndex = args.indexOf("--report");
const outputIndex = args.indexOf("--output");
if (reportIndex < 0 || !args[reportIndex + 1]) throw new Error("Pass --report with the dry-run JSON path.");
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Pass --output with the final manifest path.");

const report = JSON.parse(await readFile(path.resolve(args[reportIndex + 1]), "utf8"));
const output = path.resolve(args[outputIndex + 1]);

const topicOverrides = new Map([
  ["COE 153|Computer Hardware Assembling.pptx", ["Computer Hardware Assembly"]],
  ["COE 153|Electical Wiring.docx", ["Electrical Wiring"]],
  ["COE 153|Power Cables.pptx", ["Power Cables"]],
  ["COE 153|Web Dev.pdf", ["Web Development"]],
  ["ME 159|Geometric Construction.pptx", ["Geometric Construction"]],
  ["ME 159|Orthographic Projection.pdf", ["Orthographic Projection"]],
  ["MATH 151|COMPLEX NUMBERS.pdf", ["Complex Numbers"]],
]);

const files = report.courses.flatMap((course) => course.files.map((file) => {
  const key = `${course.code}|${file.name}`;
  let status = file.status === "READY" ? "APPROVED" : "SKIPPED";
  let reason = file.warning ?? null;
  let topics = topicOverrides.get(key) ?? file.proposedTopics ?? [];

  if (key === "COE 181|Applied Electricity Textbook.pdf") {
    status = "SKIPPED";
    reason = "Scanned 158-page textbook. Direct extraction returned 158 characters and OCR produced no usable body text on clear sample pages.";
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
  mode: "APPROVED_PLAN_NO_UPLOAD",
  rules: {
    doNotExtractCourseDetailsFromFolderPrefixes: true,
    appliedElectricityFolderMapsTo: "COE 181",
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
