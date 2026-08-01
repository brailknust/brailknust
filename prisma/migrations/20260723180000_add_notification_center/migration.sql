ALTER TABLE "notifications"
ADD COLUMN "semester_id" UUID,
ADD COLUMN "action_url" TEXT,
ADD COLUMN "source_key" TEXT,
ADD COLUMN "read_at" TIMESTAMP(3);

DROP INDEX "notifications_user_id_is_read_idx";

CREATE UNIQUE INDEX "notifications_user_id_source_key_key" ON "notifications"("user_id", "source_key");
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");
CREATE INDEX "notifications_semester_id_idx" ON "notifications"("semester_id");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_semester_id_fkey"
FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "task_deadlines" BOOLEAN NOT NULL DEFAULT true,
    "study_sessions" BOOLEAN NOT NULL DEFAULT true,
    "group_updates" BOOLEAN NOT NULL DEFAULT true,
    "goal_deadlines" BOOLEAN NOT NULL DEFAULT true,
    "qa_answers" BOOLEAN NOT NULL DEFAULT true,
    "reminder_hours" INTEGER NOT NULL DEFAULT 24,
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "notification_preferences"
ADD CONSTRAINT "notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
