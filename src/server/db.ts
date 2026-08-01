import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function runtimeDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) return undefined;

  const url = new URL(configuredUrl);
  url.searchParams.set("connection_limit", "5");
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
