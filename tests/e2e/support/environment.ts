import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

const requiredNames = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function loadE2eEnvironment() {
  const testEnvironment = path.resolve(".env.test.local");
  if (existsSync(testEnvironment)) {
    config({ path: testEnvironment });
  } else if (process.env.E2E_USE_DEVELOPMENT_ENV === "1") {
    config({ path: path.resolve(".env.local") });
  }

  const missing = requiredNames.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing E2E configuration: ${missing.join(", ")}. Use a local Supabase stack or .env.test.local.`,
    );
  }

  const hosts = [
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    new URL(process.env.DIRECT_URL!).hostname,
  ];
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  const usesRemoteService = hosts.some((host) => !localHosts.has(host));
  if (usesRemoteService && process.env.E2E_ALLOW_REMOTE !== "1") {
    throw new Error(
      "E2E tests refuse remote Supabase services unless E2E_ALLOW_REMOTE=1 is explicitly set for a disposable test environment.",
    );
  }
}
