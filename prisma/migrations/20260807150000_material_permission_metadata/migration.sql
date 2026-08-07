CREATE TYPE "MaterialPermissionBasis" AS ENUM ('AUTHOR_PERMISSION', 'OPEN_LICENSE', 'PUBLIC_DOMAIN', 'INSTITUTIONAL_USE', 'UNKNOWN');

ALTER TABLE "platform_course_materials"
  ADD COLUMN "permission_basis" "MaterialPermissionBasis" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "permission_note" TEXT;

CREATE INDEX "platform_course_materials_permission_basis_status_idx"
  ON "platform_course_materials"("permission_basis", "status");

ALTER TABLE "platform_course_materials"
  ADD CONSTRAINT "platform_material_permission_note_length"
  CHECK ("permission_note" IS NULL OR char_length("permission_note") <= 1000);
