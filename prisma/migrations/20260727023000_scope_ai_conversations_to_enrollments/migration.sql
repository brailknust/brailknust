ALTER TABLE "ai_conversations"
ADD COLUMN "enrollment_id" UUID,
ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ai_conversations" AS conversation
SET "enrollment_id" = (
    SELECT enrollment."id"
    FROM "enrollments" AS enrollment
    WHERE enrollment."user_id" = conversation."user_id"
      AND enrollment."semester_id" = conversation."semester_id"
    ORDER BY enrollment."created_at", enrollment."id"
    LIMIT 1
);

-- Conversations without any matching course enrollment cannot be safely scoped.
DELETE FROM "ai_conversations"
WHERE "enrollment_id" IS NULL;

ALTER TABLE "ai_conversations"
ALTER COLUMN "enrollment_id" SET NOT NULL;

INSERT INTO "ai_conversations" (
    "user_id",
    "semester_id",
    "enrollment_id",
    "title",
    "is_pinned",
    "created_at",
    "updated_at"
)
SELECT
    enrollment."user_id",
    enrollment."semester_id",
    enrollment."id",
    course."code" || ' - ' || course."name",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "enrollments" AS enrollment
JOIN "courses" AS course ON course."id" = enrollment."course_id";

CREATE INDEX "ai_conversations_enrollment_id_idx"
ON "ai_conversations"("enrollment_id");

CREATE UNIQUE INDEX "ai_conversations_one_pinned_per_enrollment"
ON "ai_conversations"("enrollment_id")
WHERE "is_pinned" = true;

ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_enrollment_id_fkey"
FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
