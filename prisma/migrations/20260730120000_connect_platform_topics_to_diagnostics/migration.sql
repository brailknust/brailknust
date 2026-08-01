ALTER TABLE "platform_course_topics"
ADD COLUMN "learning_outcomes" TEXT,
ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "diagnostic_questions"
ALTER COLUMN "topic_id" DROP NOT NULL,
ADD COLUMN "platform_topic_id" UUID;

ALTER TABLE "topic_masteries"
ALTER COLUMN "topic_id" DROP NOT NULL,
ADD COLUMN "platform_topic_id" UUID;

ALTER TABLE "diagnostic_questions"
ADD CONSTRAINT "diagnostic_questions_platform_topic_id_fkey"
FOREIGN KEY ("platform_topic_id") REFERENCES "platform_course_topics"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topic_masteries"
ADD CONSTRAINT "topic_masteries_platform_topic_id_fkey"
FOREIGN KEY ("platform_topic_id") REFERENCES "platform_course_topics"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "diagnostic_questions_platform_topic_id_idx"
ON "diagnostic_questions"("platform_topic_id");

CREATE INDEX "topic_masteries_platform_topic_id_idx"
ON "topic_masteries"("platform_topic_id");

CREATE UNIQUE INDEX "topic_masteries_user_id_enrollment_id_platform_topic_id_key"
ON "topic_masteries"("user_id", "enrollment_id", "platform_topic_id");
