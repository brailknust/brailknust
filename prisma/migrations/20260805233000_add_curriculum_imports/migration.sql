CREATE TYPE "CurriculumImportStatus" AS ENUM ('DRAFT', 'APPLIED', 'ROLLED_BACK');
CREATE TYPE "CurriculumImportRowStatus" AS ENUM ('VALID', 'INVALID', 'APPLIED');

CREATE TABLE "curriculum_imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_by_id" UUID NOT NULL,
  "college" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "programme" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "duration_years" INTEGER NOT NULL,
  "terms_per_year" INTEGER NOT NULL,
  "source" TEXT,
  "status" "CurriculumImportStatus" NOT NULL DEFAULT 'DRAFT',
  "curriculum_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  "rolled_back_at" TIMESTAMP(3),
  CONSTRAINT "curriculum_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculum_import_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "import_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "course_code" TEXT,
  "course_name" TEXT,
  "credit_hours" INTEGER,
  "level" "AcademicLevel",
  "term" "SemesterTerm",
  "status" "CurriculumImportRowStatus" NOT NULL DEFAULT 'VALID',
  "error" TEXT,
  CONSTRAINT "curriculum_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "curriculum_imports_curriculum_id_key" ON "curriculum_imports"("curriculum_id");
CREATE INDEX "curriculum_imports_status_created_at_idx" ON "curriculum_imports"("status", "created_at");
CREATE INDEX "curriculum_imports_created_by_id_created_at_idx" ON "curriculum_imports"("created_by_id", "created_at");
CREATE UNIQUE INDEX "curriculum_import_rows_import_id_row_number_key" ON "curriculum_import_rows"("import_id", "row_number");
CREATE INDEX "curriculum_import_rows_import_id_status_idx" ON "curriculum_import_rows"("import_id", "status");

ALTER TABLE "curriculum_imports"
  ADD CONSTRAINT "curriculum_imports_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_imports"
  ADD CONSTRAINT "curriculum_imports_curriculum_id_fkey"
  FOREIGN KEY ("curriculum_id") REFERENCES "programme_curricula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculum_import_rows"
  ADD CONSTRAINT "curriculum_import_rows_import_id_fkey"
  FOREIGN KEY ("import_id") REFERENCES "curriculum_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "curriculum_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "curriculum_import_rows" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "curriculum_imports", "curriculum_import_rows" FROM anon, authenticated;
