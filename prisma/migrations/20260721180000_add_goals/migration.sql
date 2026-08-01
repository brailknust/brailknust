CREATE TYPE "GoalCategory" AS ENUM ('ACADEMIC', 'STUDY_TIME', 'COURSE_MASTERY', 'TASKS', 'PERSONAL');
CREATE TYPE "GoalMetric" AS ENUM ('MANUAL', 'CWA', 'STUDY_MINUTES', 'TASKS_COMPLETED', 'ASSESSMENT_AVERAGE');
CREATE TYPE "GoalPeriod" AS ENUM ('SEMESTER', 'WEEKLY');
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "course_id" UUID,
    "title" TEXT NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "metric" "GoalMetric" NOT NULL DEFAULT 'MANUAL',
    "period" "GoalPeriod" NOT NULL DEFAULT 'SEMESTER',
    "target_value" DECIMAL(10,2) NOT NULL,
    "current_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deadline" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goals_user_id_semester_id_status_idx" ON "goals"("user_id", "semester_id", "status");
CREATE INDEX "goals_semester_id_idx" ON "goals"("semester_id");
CREATE INDEX "goals_course_id_idx" ON "goals"("course_id");

ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
