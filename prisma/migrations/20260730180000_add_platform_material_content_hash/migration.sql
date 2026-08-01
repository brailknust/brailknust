ALTER TABLE "platform_course_materials"
ADD COLUMN "content_hash" TEXT;

CREATE UNIQUE INDEX "platform_course_materials_course_id_content_hash_key"
ON "platform_course_materials"("course_id", "content_hash");
