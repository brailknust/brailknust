ALTER TABLE "course_materials"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "supersedes_id" UUID;

CREATE INDEX "course_materials_enrollment_id_title_type_version_idx"
  ON "course_materials"("enrollment_id", "title", "type", "version");

ALTER TABLE "course_materials"
  ADD CONSTRAINT "course_materials_supersedes_id_fkey"
  FOREIGN KEY ("supersedes_id") REFERENCES "course_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "material_ingestion_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "material_id" UUID NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status" "MaterialStatus" NOT NULL DEFAULT 'PENDING',
  "chunk_count" INTEGER,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "material_ingestion_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_ingestion_attempts_material_id_attempt_key"
  ON "material_ingestion_attempts"("material_id", "attempt");
CREATE INDEX "material_ingestion_attempts_status_started_at_idx"
  ON "material_ingestion_attempts"("status", "started_at");

ALTER TABLE "material_ingestion_attempts"
  ADD CONSTRAINT "material_ingestion_attempts_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "course_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "diagnostic_feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quiz_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "diagnostic_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "diagnostic_feedback_quiz_id_key" ON "diagnostic_feedback"("quiz_id");
CREATE INDEX "diagnostic_feedback_user_id_created_at_idx" ON "diagnostic_feedback"("user_id", "created_at");
CREATE INDEX "diagnostic_feedback_rating_created_at_idx" ON "diagnostic_feedback"("rating", "created_at");

ALTER TABLE "diagnostic_feedback"
  ADD CONSTRAINT "diagnostic_feedback_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_feedback"
  ADD CONSTRAINT "diagnostic_feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_ingestion_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_feedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "material_ingestion_attempts", "diagnostic_feedback" FROM anon, authenticated;
