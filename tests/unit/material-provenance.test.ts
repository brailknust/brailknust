import { describe, expect, it } from "vitest";

import { platformMaterialProvenanceSchema } from "@/features/materials/provenance";

describe("platform material provenance", () => {
  it("accepts an explicit permission basis and reference", () => {
    expect(platformMaterialProvenanceSchema.safeParse({ permissionBasis: "AUTHOR_PERMISSION", permissionNote: "Written approval retained by BRAIL", sourceUrl: "" }).success).toBe(true);
  });

  it("requires a source URL for open and public-domain material", () => {
    expect(platformMaterialProvenanceSchema.safeParse({ permissionBasis: "OPEN_LICENSE", permissionNote: "Creative Commons licence", sourceUrl: "" }).success).toBe(false);
    expect(platformMaterialProvenanceSchema.safeParse({ permissionBasis: "OPEN_LICENSE", permissionNote: "Creative Commons licence", sourceUrl: "https://example.edu/licence" }).success).toBe(true);
  });

  it("does not allow unknown permission on a new shared upload", () => {
    expect(platformMaterialProvenanceSchema.safeParse({ permissionBasis: "UNKNOWN", permissionNote: "Not reviewed", sourceUrl: "" }).success).toBe(false);
  });
});
