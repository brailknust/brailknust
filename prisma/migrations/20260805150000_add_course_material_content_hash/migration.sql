ALTER TABLE "course_materials" ADD COLUMN "content_hash" TEXT;

CREATE UNIQUE INDEX "course_materials_enrollment_id_content_hash_key"
  ON "course_materials"("enrollment_id", "content_hash");
