ALTER TABLE "tasks" ADD COLUMN "reminder_at" TIMESTAMP(3);

UPDATE "tasks"
SET "status" = 'TODO'
WHERE "status" = 'IN_PROGRESS';

CREATE INDEX "tasks_reminder_at_idx" ON "tasks"("reminder_at");
