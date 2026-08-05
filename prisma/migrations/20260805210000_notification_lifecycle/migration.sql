CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'DISMISSED', 'EXPIRED', 'FAILED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP');
ALTER TABLE "notifications"
  ADD COLUMN "scheduled_for" TIMESTAMP(3),
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "delivered_at" TIMESTAMP(3),
  ADD COLUMN "dismissed_at" TIMESTAMP(3),
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;

-- Preserve legacy notifications as history; never delete or re-send them during migration.
UPDATE "notifications"
SET "scheduled_for" = "created_at", "delivered_at" = "created_at",
    "status" = CASE WHEN "is_read" THEN 'READ'::"NotificationStatus" ELSE 'EXPIRED'::"NotificationStatus" END;
CREATE INDEX "notifications_user_id_status_scheduled_for_idx" ON "notifications"("user_id", "status", "scheduled_for");
CREATE INDEX "notifications_status_expires_at_idx" ON "notifications"("status", "expires_at");
