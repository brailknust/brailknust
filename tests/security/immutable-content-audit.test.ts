import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("prisma/migrations/20260807120000_admin_content_operations/migration.sql"), "utf8");

describe("immutable administrator content audit storage", () => {
  it("blocks update and deletion at the database layer", () => {
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "admin_content_audits"');
    expect(migration).toContain("admin content audit records are immutable");
  });

  it("keeps audit and correction tables out of the public data API", () => {
    expect(migration).toContain('ALTER TABLE "admin_content_audits" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "content_correction_requests" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "admin_content_audits", "content_correction_requests" FROM anon, authenticated');
  });
});
