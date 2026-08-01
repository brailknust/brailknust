CREATE TYPE "MaterialStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'ARCHIVED');

CREATE TABLE "course_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'OTHER',
    "source_url" TEXT,
    "original_file_name" TEXT,
    "mime_type" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "topic_id" UUID,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "page_label" TEXT,
    "char_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_topics_enrollment_id_title_key" ON "course_topics"("enrollment_id", "title");
CREATE INDEX "course_topics_enrollment_id_sequence_idx" ON "course_topics"("enrollment_id", "sequence");
CREATE INDEX "course_materials_enrollment_id_status_updated_at_idx" ON "course_materials"("enrollment_id", "status", "updated_at");
CREATE INDEX "course_materials_uploaded_by_idx" ON "course_materials"("uploaded_by");
CREATE UNIQUE INDEX "material_chunks_material_id_chunk_index_key" ON "material_chunks"("material_id", "chunk_index");
CREATE INDEX "material_chunks_topic_id_idx" ON "material_chunks"("topic_id");

ALTER TABLE "course_topics"
ADD CONSTRAINT "course_topics_enrollment_id_fkey"
FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_materials"
ADD CONSTRAINT "course_materials_enrollment_id_fkey"
FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_materials"
ADD CONSTRAINT "course_materials_uploaded_by_fkey"
FOREIGN KEY ("uploaded_by") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_chunks"
ADD CONSTRAINT "material_chunks_material_id_fkey"
FOREIGN KEY ("material_id") REFERENCES "course_materials"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_chunks"
ADD CONSTRAINT "material_chunks_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "course_topics"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
