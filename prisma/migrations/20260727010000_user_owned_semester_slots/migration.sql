CREATE TYPE "SemesterTerm" AS ENUM ('FIRST', 'SECOND');

ALTER TABLE "semesters"
  ADD COLUMN "owner_id" UUID,
  ADD COLUMN "level" "AcademicLevel",
  ADD COLUMN "term" "SemesterTerm",
  ADD COLUMN "cwa" DECIMAL(5,2);

UPDATE "semesters" AS semester
SET
  "owner_id" = COALESCE(
    (SELECT profile."user_id" FROM "semester_profiles" AS profile WHERE profile."semester_id" = semester."id" ORDER BY profile."created_at" LIMIT 1),
    (SELECT app_user."id" FROM "users" AS app_user WHERE app_user."active_semester_id" = semester."id" ORDER BY app_user."created_at" LIMIT 1),
    (SELECT enrollment."user_id" FROM "enrollments" AS enrollment WHERE enrollment."semester_id" = semester."id" ORDER BY enrollment."created_at" LIMIT 1)
  ),
  "level" = COALESCE(
    (SELECT profile."level" FROM "semester_profiles" AS profile WHERE profile."semester_id" = semester."id" ORDER BY profile."created_at" LIMIT 1),
    (SELECT app_user."level" FROM "users" AS app_user WHERE app_user."active_semester_id" = semester."id" ORDER BY app_user."created_at" LIMIT 1),
    'LEVEL_100'::"AcademicLevel"
  ),
  "term" = CASE WHEN lower(semester."name") LIKE 'second%' THEN 'SECOND'::"SemesterTerm" ELSE 'FIRST'::"SemesterTerm" END,
  "cwa" = (SELECT profile."cwa" FROM "semester_profiles" AS profile WHERE profile."semester_id" = semester."id" ORDER BY profile."created_at" LIMIT 1);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "semesters" WHERE "owner_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate orphan semesters without an owning user';
  END IF;
END $$;

ALTER TABLE "semesters"
  ALTER COLUMN "owner_id" SET NOT NULL,
  ALTER COLUMN "level" SET NOT NULL,
  ALTER COLUMN "term" SET NOT NULL;

ALTER TABLE "semesters"
  ADD CONSTRAINT "semesters_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "semesters_owner_id_level_term_key" ON "semesters"("owner_id", "level", "term");
CREATE INDEX "semesters_owner_id_idx" ON "semesters"("owner_id");