import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: path.resolve(".env.local") });

const args = process.argv.slice(2);
const manifestPath = path.resolve(args[args.indexOf("--manifest") + 1]);
const outputPath = path.resolve(args[args.indexOf("--output") + 1]);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const approved = manifest.files.filter((file) => file.status === "APPROVED");
const prisma = new PrismaClient();

try {
  const courses = await prisma.course.findMany({
    where: { code: { in: [...new Set(approved.map((file) => file.courseCode))] } },
    select: {
      code: true,
      platformTopics: {
        where: { isArchived: false },
        select: { title: true },
        orderBy: [{ sequence: "asc" }, { title: "asc" }],
      },
      platformMaterials: {
        where: { contentHash: { in: approved.map((file) => file.sha256) } },
        select: {
          title: true,
          contentHash: true,
          status: true,
          storagePath: true,
          _count: { select: { chunks: true, topicLinks: true } },
        },
      },
    },
    orderBy: { code: "asc" },
  });
  const materials = courses.flatMap((course) => course.platformMaterials.map((material) => ({ courseCode: course.code, ...material })));
  const report = {
    verifiedAt: new Date().toISOString(),
    expectedApprovedFiles: approved.length,
    publishedFiles: materials.filter((material) => material.status === "PUBLISHED").length,
    missingHashes: approved.filter((file) => !materials.some((material) => material.courseCode === file.courseCode && material.contentHash === file.sha256)).map((file) => `${file.courseCode}|${file.title}`),
    materialsWithoutStorage: materials.filter((material) => !material.storagePath).map((material) => `${material.courseCode}|${material.title}`),
    materialsWithoutChunks: materials.filter((material) => material._count.chunks === 0).map((material) => `${material.courseCode}|${material.title}`),
    materialsWithoutTopics: materials.filter((material) => material._count.topicLinks === 0).map((material) => `${material.courseCode}|${material.title}`),
    courses: courses.map((course) => ({
      code: course.code,
      topics: course.platformTopics.map((topic) => topic.title),
      importedMaterials: course.platformMaterials.length,
      searchableChunks: course.platformMaterials.reduce((sum, material) => sum + material._count.chunks, 0),
    })),
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
