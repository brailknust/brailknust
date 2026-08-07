ALTER TYPE "EnrollmentOrigin" ADD VALUE 'CURRICULUM_ELECTIVE';
CREATE TYPE "CurriculumCourseKind" AS ENUM ('CORE', 'ELECTIVE');

ALTER TABLE "curriculum_import_rows"
  ADD COLUMN "course_kind" "CurriculumCourseKind" NOT NULL DEFAULT 'CORE',
  ADD COLUMN "elective_group" TEXT,
  ADD COLUMN "replaces_course_code" TEXT;

ALTER TABLE "programme_curriculum_courses"
  ADD COLUMN "course_kind" "CurriculumCourseKind" NOT NULL DEFAULT 'CORE',
  ADD COLUMN "elective_group" TEXT,
  ADD COLUMN "replaces_course_code" TEXT;

ALTER TABLE "curriculum_import_rows" ADD CONSTRAINT "curriculum_import_rows_elective_group_check"
  CHECK ("course_kind" = 'CORE' OR NULLIF(BTRIM("elective_group"), '') IS NOT NULL);
ALTER TABLE "curriculum_import_rows" ADD CONSTRAINT "curriculum_import_rows_replacement_code_check"
  CHECK ("replaces_course_code" IS NULL OR "replaces_course_code" <> "course_code");
ALTER TABLE "programme_curriculum_courses" ADD CONSTRAINT "programme_curriculum_courses_elective_group_check"
  CHECK ("course_kind" = 'CORE' OR NULLIF(BTRIM("elective_group"), '') IS NOT NULL);
ALTER TABLE "programme_curriculum_courses" ADD CONSTRAINT "programme_curriculum_courses_replacement_code_check"
  CHECK ("replaces_course_code" IS NULL OR "replaces_course_code" <> "course_code");

CREATE INDEX "programme_curriculum_courses_curriculum_term_id_course_kind_elective_group_idx"
  ON "programme_curriculum_courses"("curriculum_term_id", "course_kind", "elective_group");
CREATE INDEX "programme_curriculum_courses_replaces_course_code_idx"
  ON "programme_curriculum_courses"("replaces_course_code");
