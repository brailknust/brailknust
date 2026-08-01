CREATE TABLE "programme_course_exclusions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "college" TEXT NOT NULL,
  "programme" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "level" "AcademicLevel" NOT NULL,
  "semester" TEXT NOT NULL,
  "course_code" TEXT NOT NULL,
  "removed_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "programme_course_exclusions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "programme_course_exclusions_removed_by_id_fkey"
    FOREIGN KEY ("removed_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "programme_course_exclusions_programme_level_semester_course_code_key"
ON "programme_course_exclusions"("programme", "level", "semester", "course_code");

CREATE INDEX "programme_course_exclusions_programme_level_semester_idx"
ON "programme_course_exclusions"("programme", "level", "semester");

CREATE INDEX "programme_course_exclusions_removed_by_id_idx"
ON "programme_course_exclusions"("removed_by_id");
