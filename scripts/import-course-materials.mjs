import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: path.resolve(".env.local") });

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const reportIndex = args.indexOf("--report");
if (manifestIndex < 0 || !args[manifestIndex + 1]) throw new Error("Pass --manifest with the approved manifest.");
if (reportIndex < 0 || !args[reportIndex + 1]) throw new Error("Pass --report with a progress report path.");

const manifestPath = path.resolve(args[manifestIndex + 1]);
const progressPath = path.resolve(args[reportIndex + 1]);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.mode !== "APPROVED_PLAN_NO_UPLOAD") throw new Error("The manifest has not been approved for import.");

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl || !supabaseUrl || !serviceRoleKey) throw new Error("Database or Supabase service credentials are missing.");

const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = "course-materials";
const supportedOfficeTypes = new Set(["pdf", "docx", "pptx"]);

function safeName(name) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function mimeType(extension) {
  return {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  }[extension] ?? "application/octet-stream";
}

function chunksFromText(input) {
  const text = input
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 1600, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf(" ", end));
      if (boundary > start + 800) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - 180, start + 1);
  }
  return chunks;
}

async function extractText(filePath, extension) {
  if (extension === "txt" || extension === "md") return (await readFile(filePath, "utf8")).trim();
  if (!supportedOfficeTypes.has(extension)) throw new Error(`Automated import extraction does not support .${extension}.`);
  const imported = await import("officeparser");
  const parseOffice = imported.parseOffice ?? imported.OfficeParser?.parseOffice ?? imported.default?.parseOffice;
  if (typeof parseOffice !== "function") throw new Error("officeparser could not be initialized.");
  const ast = await parseOffice(await readFile(filePath), {
    fileType: extension,
    includeRawContent: false,
    extractAttachments: false,
    ocr: false,
  });
  return ast.toText().trim();
}

const progress = {
  manifest: manifestPath,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  results: [],
  summary: { approved: manifest.summary.approved, imported: 0, skippedExisting: 0, failed: 0 },
};

async function saveProgress() {
  progress.updatedAt = new Date().toISOString();
  await writeFile(progressPath, JSON.stringify(progress, null, 2), "utf8");
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(bucket);
  const options = {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
  };
  const response = data
    ? await supabase.storage.updateBucket(bucket, options)
    : await supabase.storage.createBucket(bucket, options);
  if (response.error) throw response.error;
}

try {
  await ensureBucket();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true } });
  if (!admin) throw new Error("No administrator account exists to own imported materials.");

  for (const file of manifest.files.filter((item) => item.status === "APPROVED")) {
    const startedAt = new Date().toISOString();
    console.log(`IMPORT ${file.courseCode}: ${file.title}`);
    try {
      const course = await prisma.course.findUnique({ where: { code: file.courseCode }, select: { id: true, code: true } });
      if (!course) throw new Error(`Catalog course ${file.courseCode} does not exist.`);

      const existing = await prisma.platformCourseMaterial.findUnique({
        where: { courseId_contentHash: { courseId: course.id, contentHash: file.sha256 } },
        select: { id: true, status: true, title: true },
      });
      if (existing?.status === "PUBLISHED") {
        progress.results.push({ ...file, outcome: "SKIPPED_EXISTING", materialId: existing.id, startedAt, finishedAt: new Date().toISOString() });
        progress.summary.skippedExisting += 1;
        await saveProgress();
        continue;
      }

      const sourcePath = path.resolve(manifest.sourceRoot, file.sourceRelativePath);
      const bytes = await readFile(sourcePath);
      if (bytes.length > 50 * 1024 * 1024) throw new Error("File exceeds 50MB.");
      const extension = path.extname(sourcePath).slice(1).toLowerCase();
      const text = await extractText(sourcePath, extension);
      const chunks = chunksFromText(text);
      if (!chunks.length || text.length < 40) throw new Error("The file did not contain enough extractable text.");

      const existingTopics = await prisma.platformCourseTopic.findMany({
        where: { courseId: course.id, title: { in: file.topics } },
        select: { id: true, title: true },
      });
      const byTitle = new Map(existingTopics.map((topic) => [topic.title, topic]));
      let nextSequence = await prisma.platformCourseTopic.count({ where: { courseId: course.id } });
      for (const title of file.topics) {
        if (!byTitle.has(title)) {
          const topic = await prisma.platformCourseTopic.create({
            data: { courseId: course.id, title, sequence: nextSequence },
            select: { id: true, title: true },
          });
          byTitle.set(title, topic);
          nextSequence += 1;
        }
      }
      const topics = file.topics.map((title) => byTitle.get(title)).filter(Boolean);
      if (!topics.length) throw new Error("No import topics were resolved.");

      const material = existing ?? await prisma.platformCourseMaterial.create({
        data: {
          courseId: course.id,
          topicId: topics[0].id,
          uploadedBy: admin.id,
          title: file.title,
          type: file.materialType,
          originalFileName: path.basename(sourcePath),
          mimeType: mimeType(extension),
          fileSize: bytes.length,
          contentHash: file.sha256,
          status: "FAILED",
        },
        select: { id: true, status: true, title: true },
      });
      const storagePath = `platform/${course.id}/${material.id}/${safeName(path.basename(sourcePath))}`;
      const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
        contentType: mimeType(extension),
        upsert: true,
      });
      if (upload.error) throw upload.error;

      await prisma.$transaction([
        prisma.platformMaterialChunk.deleteMany({ where: { materialId: material.id } }),
        prisma.platformMaterialTopic.deleteMany({ where: { materialId: material.id } }),
        prisma.platformMaterialChunk.createMany({
          data: chunks.map((content, chunkIndex) => ({
            materialId: material.id,
            topicId: topics[0].id,
            chunkIndex,
            content,
            charCount: content.length,
          })),
        }),
        prisma.platformMaterialTopic.createMany({
          data: topics.map((topic) => ({ materialId: material.id, topicId: topic.id })),
          skipDuplicates: true,
        }),
        prisma.platformCourseMaterial.update({
          where: { id: material.id },
          data: {
            topicId: topics[0].id,
            storagePath,
            status: "PUBLISHED",
            errorMessage: null,
            title: file.title,
            type: file.materialType,
            contentHash: file.sha256,
          },
        }),
      ]);
      progress.results.push({
        ...file,
        outcome: "IMPORTED",
        materialId: material.id,
        chunkCount: chunks.length,
        extractedCharacters: text.length,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      progress.summary.imported += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAILED ${file.courseCode}: ${file.title}: ${message}`);
      progress.results.push({ ...file, outcome: "FAILED", error: message, startedAt, finishedAt: new Date().toISOString() });
      progress.summary.failed += 1;
    }
    await saveProgress();
  }
  progress.completedAt = new Date().toISOString();
  await saveProgress();
  console.log(JSON.stringify(progress.summary, null, 2));
} finally {
  await prisma.$disconnect();
}
