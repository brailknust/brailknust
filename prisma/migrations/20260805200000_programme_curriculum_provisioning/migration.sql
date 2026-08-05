CREATE TYPE "EnrollmentOrigin" AS ENUM ('CURRICULUM_DEFAULT', 'MANUAL', 'TRANSFER', 'REPEAT');

CREATE TABLE "programme_curricula" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "college" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "programme" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "duration_years" INTEGER NOT NULL,
  "terms_per_year" INTEGER NOT NULL,
  "source" TEXT,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "programme_curricula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "programme_curricula_college_programme_version_key" ON "programme_curricula"("college", "programme", "version");
CREATE INDEX "programme_curricula_programme_version_is_published_idx" ON "programme_curricula"("programme", "version", "is_published");

CREATE TABLE "programme_curriculum_terms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "curriculum_id" UUID NOT NULL,
  "level" "AcademicLevel" NOT NULL,
  "term" "SemesterTerm" NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "programme_curriculum_terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "programme_curriculum_terms_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "programme_curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "programme_curriculum_terms_curriculum_id_level_term_key" ON "programme_curriculum_terms"("curriculum_id", "level", "term");

CREATE TABLE "programme_curriculum_courses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "curriculum_term_id" UUID NOT NULL,
  "course_code" TEXT NOT NULL,
  "course_name" TEXT NOT NULL,
  "credit_hours" INTEGER NOT NULL,
  "is_approved" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "programme_curriculum_courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "programme_curriculum_courses_curriculum_term_id_fkey" FOREIGN KEY ("curriculum_term_id") REFERENCES "programme_curriculum_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "programme_curriculum_courses_curriculum_term_id_course_code_key" ON "programme_curriculum_courses"("curriculum_term_id", "course_code");

ALTER TABLE "semesters" ADD COLUMN "is_custom" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "provision_key" TEXT, ADD COLUMN "curriculum_id" UUID, ADD COLUMN "curriculum_term_id" UUID;
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "programme_curricula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_curriculum_term_id_fkey" FOREIGN KEY ("curriculum_term_id") REFERENCES "programme_curriculum_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX "semesters_owner_id_level_term_key";
CREATE UNIQUE INDEX "semesters_owner_id_provision_key_key" ON "semesters"("owner_id", "provision_key");

ALTER TABLE "enrollments" ADD COLUMN "origin" "EnrollmentOrigin" NOT NULL DEFAULT 'MANUAL', ADD COLUMN "source_key" TEXT;
CREATE UNIQUE INDEX "enrollments_user_id_semester_id_source_key_key" ON "enrollments"("user_id", "semester_id", "source_key");

CREATE TABLE "student_course_exclusions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "user_id" UUID NOT NULL, "semester_id" UUID NOT NULL, "course_code" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_course_exclusions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_course_exclusions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "student_course_exclusions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "student_course_exclusions_user_id_semester_id_course_code_key" ON "student_course_exclusions"("user_id", "semester_id", "course_code");

ALTER TABLE "goals" ADD COLUMN "source_key" TEXT;
CREATE UNIQUE INDEX "goals_user_id_semester_id_source_key_key" ON "goals"("user_id", "semester_id", "source_key");

-- Existing records are preserved as exceptions. They are never rewritten by a later curriculum import.
UPDATE "semesters" SET "is_custom" = true WHERE "curriculum_id" IS NULL;

ALTER TABLE "programme_curricula" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programme_curriculum_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programme_curriculum_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_course_exclusions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "programme_curricula", "programme_curriculum_terms", "programme_curriculum_courses", "student_course_exclusions" FROM anon, authenticated;
