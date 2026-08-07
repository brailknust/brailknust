import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: path.resolve(".env.local") });
const prisma = new PrismaClient();

try {
  const materials = await prisma.platformCourseMaterial.findMany({
    where: { status: "PUBLISHED" },
    select: { permissionBasis: true, permissionNote: true, sourceUrl: true },
  });
  const byBasis = Object.fromEntries(["AUTHOR_PERMISSION", "OPEN_LICENSE", "PUBLIC_DOMAIN", "INSTITUTIONAL_USE", "UNKNOWN"].map((basis) => [basis, materials.filter((item) => item.permissionBasis === basis).length]));
  const reviewed = materials.filter((item) => item.permissionBasis !== "UNKNOWN" && item.permissionNote?.trim()).length;
  const publicRecordsWithoutUrl = materials.filter((item) => ["OPEN_LICENSE", "PUBLIC_DOMAIN"].includes(item.permissionBasis) && !item.sourceUrl).length;
  const report = {
    verifiedAt: new Date().toISOString(),
    publishedMaterials: materials.length,
    reviewedMaterials: reviewed,
    pendingReview: materials.length - reviewed,
    publicRecordsWithoutUrl,
    complete: reviewed === materials.length && publicRecordsWithoutUrl === 0,
    byPermissionBasis: byBasis,
    note: "UNKNOWN is a deliberate safe backfill and must not be interpreted as permission to distribute.",
  };
  const output = path.resolve("evaluation-reports/material-provenance.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
