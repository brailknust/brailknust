CREATE TABLE "rate_limit_buckets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subject" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "bucket_start" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_buckets_subject_action_bucket_start_key"
  ON "rate_limit_buckets"("subject", "action", "bucket_start");
CREATE INDEX "rate_limit_buckets_bucket_start_idx"
  ON "rate_limit_buckets"("bucket_start");

ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "rate_limit_buckets" FROM anon, authenticated;
