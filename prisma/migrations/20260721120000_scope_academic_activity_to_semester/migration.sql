ALTER TABLE "tasks" ADD COLUMN "semester_id" UUID;
ALTER TABLE "timetable_blocks" ADD COLUMN "semester_id" UUID;
ALTER TABLE "study_plans" ADD COLUMN "semester_id" UUID;
ALTER TABLE "weak_areas" ADD COLUMN "semester_id" UUID;

UPDATE "tasks" AS record
SET "semester_id" = users."active_semester_id"
FROM "users"
WHERE record."user_id" = users."id";

UPDATE "timetable_blocks" AS record
SET "semester_id" = users."active_semester_id"
FROM "users"
WHERE record."user_id" = users."id";

UPDATE "study_plans" AS record
SET "semester_id" = users."active_semester_id"
FROM "users"
WHERE record."user_id" = users."id";

UPDATE "weak_areas" AS record
SET "semester_id" = users."active_semester_id"
FROM "users"
WHERE record."user_id" = users."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "tasks" WHERE "semester_id" IS NULL
    UNION ALL SELECT 1 FROM "timetable_blocks" WHERE "semester_id" IS NULL
    UNION ALL SELECT 1 FROM "study_plans" WHERE "semester_id" IS NULL
    UNION ALL SELECT 1 FROM "weak_areas" WHERE "semester_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot scope existing academic activity because its user has no active semester.';
  END IF;
END $$;

ALTER TABLE "tasks" ALTER COLUMN "semester_id" SET NOT NULL;
ALTER TABLE "timetable_blocks" ALTER COLUMN "semester_id" SET NOT NULL;
ALTER TABLE "study_plans" ALTER COLUMN "semester_id" SET NOT NULL;
ALTER TABLE "weak_areas" ALTER COLUMN "semester_id" SET NOT NULL;

CREATE INDEX "tasks_user_id_semester_id_status_idx" ON "tasks"("user_id", "semester_id", "status");
CREATE INDEX "tasks_semester_id_idx" ON "tasks"("semester_id");
CREATE INDEX "timetable_blocks_user_id_semester_id_day_of_week_idx" ON "timetable_blocks"("user_id", "semester_id", "day_of_week");
CREATE INDEX "timetable_blocks_semester_id_idx" ON "timetable_blocks"("semester_id");
CREATE INDEX "study_plans_user_id_semester_id_status_idx" ON "study_plans"("user_id", "semester_id", "status");
CREATE INDEX "study_plans_semester_id_idx" ON "study_plans"("semester_id");
CREATE INDEX "weak_areas_user_id_semester_id_course_id_idx" ON "weak_areas"("user_id", "semester_id", "course_id");
CREATE INDEX "weak_areas_semester_id_idx" ON "weak_areas"("semester_id");

DROP INDEX "tasks_user_id_status_idx";
DROP INDEX "timetable_blocks_user_id_day_of_week_idx";
DROP INDEX "study_plans_user_id_status_idx";
DROP INDEX "weak_areas_user_id_course_id_idx";

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_blocks" ADD CONSTRAINT "timetable_blocks_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weak_areas" ADD CONSTRAINT "weak_areas_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
