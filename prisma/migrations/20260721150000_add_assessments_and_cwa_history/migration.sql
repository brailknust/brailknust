CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'LAB', 'PROJECT', 'MIDSEM', 'EXAM', 'OTHER');

CREATE TABLE "assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "type" "AssessmentType" NOT NULL DEFAULT 'OTHER',
  "score" DECIMAL(7,2) NOT NULL,
  "max_score" DECIMAL(7,2) NOT NULL,
  "weight" DECIMAL(5,2),
  "assessed_at" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cwa_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "cwa" DECIMAL(5,2) NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cwa_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assessments_user_id_semester_id_course_id_idx" ON "assessments"("user_id", "semester_id", "course_id");
CREATE INDEX "assessments_semester_id_idx" ON "assessments"("semester_id");
CREATE INDEX "cwa_snapshots_user_id_semester_id_recorded_at_idx" ON "cwa_snapshots"("user_id", "semester_id", "recorded_at");
CREATE INDEX "cwa_snapshots_semester_id_idx" ON "cwa_snapshots"("semester_id");

ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cwa_snapshots" ADD CONSTRAINT "cwa_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cwa_snapshots" ADD CONSTRAINT "cwa_snapshots_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;