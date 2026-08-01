ALTER TABLE "course_materials"
ADD COLUMN "storage_path" TEXT,
ADD COLUMN "file_size" INTEGER;

CREATE UNIQUE INDEX "course_materials_storage_path_key"
ON "course_materials"("storage_path")
WHERE "storage_path" IS NOT NULL;
