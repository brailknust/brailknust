CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'IDEA', 'PRAISE', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'PLANNED', 'CLOSED');

CREATE TABLE "support_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "FeedbackType" NOT NULL DEFAULT 'OTHER',
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_requests_user_id_status_created_at_idx" ON "support_requests"("user_id", "status", "created_at");
CREATE INDEX "feedback_user_id_status_created_at_idx" ON "feedback"("user_id", "status", "created_at");

ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
