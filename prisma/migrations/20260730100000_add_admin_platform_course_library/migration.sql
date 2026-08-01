CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE "PlatformMaterialStatus" AS ENUM ('PUBLISHED', 'ARCHIVED', 'FAILED');

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STUDENT';

CREATE TABLE "platform_course_topics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "course_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_course_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_course_materials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "course_id" UUID NOT NULL,
  "topic_id" UUID,
  "uploaded_by" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "type" "ResourceType" NOT NULL DEFAULT 'OTHER',
  "storage_path" TEXT,
  "original_file_name" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "source_url" TEXT,
  "status" "PlatformMaterialStatus" NOT NULL DEFAULT 'PUBLISHED',
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_course_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_material_chunks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "material_id" UUID NOT NULL,
  "topic_id" UUID,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "char_count" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_material_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_course_topics_course_id_title_key" ON "platform_course_topics"("course_id", "title");
CREATE INDEX "platform_course_topics_course_id_sequence_idx" ON "platform_course_topics"("course_id", "sequence");
CREATE INDEX "platform_course_materials_course_id_status_updated_at_idx" ON "platform_course_materials"("course_id", "status", "updated_at");
CREATE INDEX "platform_course_materials_topic_id_idx" ON "platform_course_materials"("topic_id");
CREATE UNIQUE INDEX "platform_material_chunks_material_id_chunk_index_key" ON "platform_material_chunks"("material_id", "chunk_index");
CREATE INDEX "platform_material_chunks_topic_id_idx" ON "platform_material_chunks"("topic_id");

ALTER TABLE "platform_course_topics" ADD CONSTRAINT "platform_course_topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_course_materials" ADD CONSTRAINT "platform_course_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_course_materials" ADD CONSTRAINT "platform_course_materials_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "platform_course_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_course_materials" ADD CONSTRAINT "platform_course_materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_material_chunks" ADD CONSTRAINT "platform_material_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "platform_course_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_material_chunks" ADD CONSTRAINT "platform_material_chunks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "platform_course_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
