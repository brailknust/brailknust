import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const supportedExtensions = new Set([".pdf", ".docx", ".pptx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"]);
const legacyExtensions = new Set([".ppt", ".pptm"]);
const maxBytes = 50 * 1024 * 1024;

function parseArguments() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const outputIndex = args.indexOf("--output");
  const configIndex = args.indexOf("--config");
  if (sourceIndex < 0 || !args[sourceIndex + 1]) throw new Error("Pass --source with the semester folder path.");
  if (configIndex < 0 || !args[configIndex + 1]) throw new Error("Pass --config with the term's course-material-config JSON path.");
  return {
    source: path.resolve(args[sourceIndex + 1]),
    output: path.resolve(outputIndex >= 0 && args[outputIndex + 1] ? args[outputIndex + 1] : "import-reports"),
    config: path.resolve(args[configIndex + 1]),
  };
}

async function loadConfig(configPath) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (!config.termSlug) throw new Error(`Config ${configPath} is missing "termSlug".`);
  if (!Array.isArray(config.courseMappings)) throw new Error(`Config ${configPath} is missing "courseMappings".`);
  config.topicRules ??= {};
  config.reportTitle ??= `Computer Engineering — ${config.termSlug} import dry run`;
  return config;
}

function materialType(fileName) {
  const value = fileName.toLowerCase();
  if (value.includes("passco") || value.includes("past question") || value.includes("exam practice")) return "PAST_QUESTION";
  if (value.includes("textbook")) return "OTHER";
  if (value.includes("slide") || value.includes("lecture") || [".pptx"].includes(path.extname(value))) return "SLIDE";
  return "NOTE";
}

function broadMaterial(fileName) {
  return /(combined|textbook|slides|passco|exam practice)/i.test(fileName);
}

async function extractText(filePath, extension) {
  if (extension === ".txt" || extension === ".md") return readFile(filePath, "utf8");
  if (![".pdf", ".docx", ".pptx"].includes(extension)) return "";
  const imported = await import("officeparser");
  const parseOffice = imported.parseOffice ?? imported.OfficeParser?.parseOffice ?? imported.default?.parseOffice;
  if (typeof parseOffice !== "function") throw new Error("officeparser could not be initialized");
  const ast = await parseOffice(await readFile(filePath), {
    fileType: extension.slice(1),
    includeRawContent: false,
    extractAttachments: false,
    ocr: false,
  });
  return ast.toText();
}

function proposedTopics(topicRules, courseCode, fileName, text) {
  const searchable = `${fileName}\n${text.slice(0, 250000)}`.toLowerCase();
  const matches = (topicRules[courseCode] ?? [])
    .filter(([, keywords]) => keywords.some((keyword) => searchable.includes(keyword)))
    .map(([topic]) => topic);
  const topics = [];
  if (broadMaterial(fileName) || matches.length === 0) topics.push("General resources");
  if (materialType(fileName) === "PAST_QUESTION") topics.push("Past Questions");
  topics.push(...matches.slice(0, 5));
  return [...new Set(topics)];
}

function markdownReport(report) {
  const lines = [
    `# ${report.reportTitle}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "No files were uploaded and no database records were changed.",
    "",
    "## Summary",
    "",
    `- Files discovered: ${report.summary.discovered}`,
    `- Ready for import: ${report.summary.ready}`,
    `- Skipped: ${report.summary.skipped}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Ready size: ${report.summary.readySizeMB} MB`,
    "",
  ];
  for (const course of report.courses) {
    lines.push(`## ${course.code} — ${course.name}`, "");
    if (course.note) lines.push(`> ${course.note}`, "");
    lines.push("| File | Type | Size | Proposed topics | Status |", "|---|---:|---:|---|---|");
    for (const file of course.files) {
      lines.push(`| ${file.name.replaceAll("|", "\\|")} | ${file.materialType ?? "—"} | ${file.sizeMB} MB | ${(file.proposedTopics ?? []).join(", ") || "—"} | ${file.status}${file.warning ? `: ${file.warning}` : ""} |`);
    }
    lines.push("");
  }
  if (report.unmatchedFolders.length) {
    lines.push("## Unmatched folders", "", "These folders did not match any course in the config's `courseMappings` and were not scanned.", "", ...report.unmatchedFolders.map((folder) => `- ${folder}`), "");
  }
  if (report.duplicateGroups.length) {
    lines.push("## Duplicate files (identical sha256)", "");
    for (const group of report.duplicateGroups) lines.push(`- ${group.files.join(" == ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const { source, output, config: configPath } = parseArguments();
  const config = await loadConfig(configPath);
  const entries = await readdir(source, { withFileTypes: true });
  const folderEntries = entries.filter((entry) => entry.isDirectory());
  const report = {
    generatedAt: new Date().toISOString(),
    source,
    mode: "DRY_RUN",
    termSlug: config.termSlug,
    reportTitle: config.reportTitle,
    rules: {
      maxFileSizeMB: 50,
      skippedExtensions: [...legacyExtensions],
      folderPrefixesIgnored: true,
      supportsGeneralAndMultipleTopics: true,
    },
    courses: [],
    unmatchedFolders: [],
    duplicateGroups: [],
    summary: { discovered: 0, ready: 0, skipped: 0, warnings: 0, readySizeMB: 0 },
  };
  const hashes = new Map();

  for (const folder of folderEntries) {
    const mapping = config.courseMappings.find((item) => folder.name.includes(item.folderIncludes));
    if (!mapping) {
      report.unmatchedFolders.push(folder.name);
      continue;
    }
    const course = { code: mapping.code, name: mapping.name, sourceFolder: folder.name, note: mapping.note, files: [] };
    const folderPath = path.join(source, folder.name);
    const files = (await readdir(folderPath, { withFileTypes: true })).filter((entry) => entry.isFile());
    for (const entry of files) {
      report.summary.discovered += 1;
      const filePath = path.join(folderPath, entry.name);
      const extension = path.extname(entry.name).toLowerCase();
      const bytes = await readFile(filePath);
      const sizeMB = Math.round((bytes.length / 1024 / 1024) * 100) / 100;
      const hash = createHash("sha256").update(bytes).digest("hex");
      const item = { name: entry.name, extension, sizeMB, sha256: hash, status: "READY" };
      const sameHash = hashes.get(hash) ?? [];
      sameHash.push(`${folder.name}\\${entry.name}`);
      hashes.set(hash, sameHash);

      if (legacyExtensions.has(extension)) {
        Object.assign(item, { status: "SKIPPED", warning: `Legacy ${extension} is intentionally skipped.` });
      } else if (!supportedExtensions.has(extension)) {
        Object.assign(item, { status: "SKIPPED", warning: `Unsupported extension ${extension || "(none)"}.` });
      } else if (bytes.length > maxBytes) {
        Object.assign(item, { status: "SKIPPED", warning: "File exceeds the 50MB limit." });
      } else {
        item.materialType = materialType(entry.name);
        let text = "";
        try {
          text = await extractText(filePath, extension);
          item.extractedCharacters = text.length;
          if (text.trim().length < 40 && ![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
            item.warning = "Very little text was extracted; review before import.";
          }
        } catch (error) {
          item.warning = `Text preview failed: ${error instanceof Error ? error.message : String(error)}`;
        }
        item.proposedTopics = proposedTopics(config.topicRules, mapping.code, entry.name, text);
      }
      if (item.status === "READY") {
        report.summary.ready += 1;
        report.summary.readySizeMB += sizeMB;
      } else {
        report.summary.skipped += 1;
      }
      if (item.warning) report.summary.warnings += 1;
      course.files.push(item);
    }
    report.courses.push(course);
  }
  report.summary.readySizeMB = Math.round(report.summary.readySizeMB * 100) / 100;
  report.duplicateGroups = [...hashes.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([sha256, files]) => ({ sha256, files }));

  await mkdir(output, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = path.join(output, `${config.termSlug}-dry-run-${stamp}.json`);
  const markdownPath = path.join(output, `${config.termSlug}-dry-run-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(markdownPath, markdownReport(report), "utf8");
  console.log(JSON.stringify({
    jsonPath,
    markdownPath,
    summary: report.summary,
    unmatchedFolders: report.unmatchedFolders,
    duplicateGroups: report.duplicateGroups.length,
  }, null, 2));
}

await main();
