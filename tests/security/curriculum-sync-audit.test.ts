import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(resolve("scripts/sync-bundled-curricula.mjs"), "utf8");

describe("operational curriculum synchronization boundaries", () => {
  it("attributes execution to an active administrator in the configured allow-list", () => {
    expect(script).toContain("process.env.ADMIN_EMAILS");
    expect(script).toContain('role: "ADMIN", deletedAt: null');
    expect(script).toContain("No active administrator matches the configured administrator allow-list");
  });

  it("preserves an authoritative curriculum import", () => {
    expect(script).toContain("if (existing?.importedFrom)");
    expect(script).toContain("skippedAuthoritativeImport: true");
  });

  it("appends an immutable audit event with aggregate metadata", () => {
    expect(script).toContain("prisma.adminContentAudit.create");
    expect(script).toContain('action: "BUNDLED_CURRICULA_SYNCED_OPERATIONALLY"');
    expect(script).toContain('targetId: "bundled-curricula"');
    expect(script).toContain("external KNUST approval remains separately required");
  });
});
