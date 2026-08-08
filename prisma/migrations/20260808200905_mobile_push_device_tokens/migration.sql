-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_course_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_semester_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_timetable_block_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cwa_evidence_records" DROP CONSTRAINT "cwa_evidence_records_semester_id_fkey";

-- DropForeignKey
ALTER TABLE "cwa_evidence_records" DROP CONSTRAINT "cwa_evidence_records_user_id_fkey";

-- DropForeignKey
ALTER TABLE "study_sessions" DROP CONSTRAINT "study_sessions_course_id_fkey";

-- DropForeignKey
ALTER TABLE "study_sessions" DROP CONSTRAINT "study_sessions_semester_id_fkey";

-- DropForeignKey
ALTER TABLE "study_sessions" DROP CONSTRAINT "study_sessions_study_plan_item_id_fkey";

-- DropForeignKey
ALTER TABLE "study_sessions" DROP CONSTRAINT "study_sessions_user_id_fkey";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "pushed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "attendance_records_user_id_semester_id_status_idx" ON "attendance_records"("user_id", "semester_id", "status");

-- CreateIndex
CREATE INDEX "cwa_evidence_records_user_id_semester_id_mode_created_at_idx" ON "cwa_evidence_records"("user_id", "semester_id", "mode", "created_at");

-- CreateIndex
CREATE INDEX "notifications_pushed_at_idx" ON "notifications"("pushed_at");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_semester_id_status_idx" ON "study_sessions"("user_id", "semester_id", "status");

-- CreateIndex
CREATE INDEX "study_sessions_study_plan_item_id_idx" ON "study_sessions"("study_plan_item_id");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_timetable_block_id_fkey" FOREIGN KEY ("timetable_block_id") REFERENCES "timetable_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_study_plan_item_id_fkey" FOREIGN KEY ("study_plan_item_id") REFERENCES "study_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cwa_evidence_records" ADD CONSTRAINT "cwa_evidence_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cwa_evidence_records" ADD CONSTRAINT "cwa_evidence_records_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "programme_course_exclusions_programme_level_semester_course_cod" RENAME TO "programme_course_exclusions_programme_level_semester_course_key";

-- RenameIndex
ALTER INDEX "programme_curriculum_courses_curriculum_term_id_course_kind_ele" RENAME TO "programme_curriculum_courses_curriculum_term_id_course_kind_idx";
