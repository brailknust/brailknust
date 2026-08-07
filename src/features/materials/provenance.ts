import { z } from "zod";

export const materialPermissionBasisSchema = z.enum([
  "AUTHOR_PERMISSION",
  "OPEN_LICENSE",
  "PUBLIC_DOMAIN",
  "INSTITUTIONAL_USE",
]);

export const platformMaterialProvenanceSchema = z.object({
  permissionBasis: materialPermissionBasisSchema,
  permissionNote: z.string().trim().min(5).max(1000),
  sourceUrl: z.union([z.string().url().max(2000), z.literal("")]).optional(),
}).superRefine((value, context) => {
  if (["OPEN_LICENSE", "PUBLIC_DOMAIN"].includes(value.permissionBasis) && !value.sourceUrl) {
    context.addIssue({ code: "custom", path: ["sourceUrl"], message: "Add the public source or licence URL." });
  }
});

export const materialPermissionLabels = {
  AUTHOR_PERMISSION: "Author or rights-holder permission",
  OPEN_LICENSE: "Open licence",
  PUBLIC_DOMAIN: "Public domain",
  INSTITUTIONAL_USE: "Institutional educational permission",
  UNKNOWN: "Permission not yet reviewed",
} as const;
